// Burst load generator for the OpenTelemetry AI Chatbot workshop.
//
// Cycles forever between:
//   * BURST_MIN minutes at BURST_RPS requests/sec
//   * IDLE_MIN  minutes idle
//
// Each request rotates through PROMPTS_FILE and is tagged with a fake user_id
// and session_id so the resulting Honeycomb traces show real high-cardinality
// distributions for BubbleUp / P99 demos.

import { readFileSync } from 'node:fs';

const TARGET = process.env.TARGET_URL || 'http://localhost:3001';
const BURST_RPS = Number(process.env.BURST_RPS || 5);
const BURST_MIN = Number(process.env.BURST_MIN || 5);
const IDLE_MIN = Number(process.env.IDLE_MIN || 5);
const PROMPTS_FILE = process.env.PROMPTS_FILE || '/app/prompts.json';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 90_000);
const USER_POOL_SIZE = Number(process.env.USER_POOL_SIZE || 50);

const prompts = JSON.parse(readFileSync(PROMPTS_FILE, 'utf-8'));
if (!Array.isArray(prompts) || prompts.length === 0) {
  console.error('prompts.json must be a non-empty array');
  process.exit(1);
}

function log(event, extra = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...extra }));
}

async function sendOne(prompt, userId, sessionId) {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${TARGET}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, userId, sessionId }),
      signal: controller.signal,
    });
    // Drain body so the connection can be reused.
    await res.arrayBuffer();
    log('request', {
      status: res.status,
      duration_ms: Date.now() - start,
      user_id: userId,
      session_id: sessionId,
    });
  } catch (err) {
    log('request_error', {
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      duration_ms: Date.now() - start,
      user_id: userId,
      session_id: sessionId,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function newSessionId() {
  return `sess-${Math.random().toString(36).slice(2, 10)}`;
}

async function burst() {
  log('phase', { phase: 'burst', rps: BURST_RPS, minutes: BURST_MIN });
  const interval = 1000 / BURST_RPS;
  const endAt = Date.now() + BURST_MIN * 60_000;
  let i = 0;
  while (Date.now() < endAt) {
    const prompt = prompts[i++ % prompts.length];
    const userId = `user-${Math.floor(Math.random() * USER_POOL_SIZE)}`;
    const sessionId = newSessionId();
    // Fire-and-forget so a slow /api/chat (and they are slow) doesn't stall
    // the burst rate.
    sendOne(prompt, userId, sessionId).catch(() => {});
    await new Promise((r) => setTimeout(r, interval));
  }
  // Give in-flight requests up to 30 s to drain before going idle.
  log('phase', { phase: 'drain', seconds: 30 });
  await new Promise((r) => setTimeout(r, 30_000));
}

async function idle() {
  log('phase', { phase: 'idle', minutes: IDLE_MIN });
  await new Promise((r) => setTimeout(r, IDLE_MIN * 60_000));
}

async function main() {
  log('start', { target: TARGET, prompts: prompts.length });
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await burst();
    await idle();
  }
}

main().catch((err) => {
  log('fatal', { error: err.message });
  process.exit(1);
});
