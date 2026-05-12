import { trace, SpanStatusCode } from '@opentelemetry/api';
import { countTokens } from '@anthropic-ai/tokenizer';
import logger from '../config/logger.js';

const tracer = trace.getTracer('tokenization', '1.0.0');

// Local BPE tokenization of a prompt before sending it to the LLM.
//
// Two reasons we tokenize in-process instead of trusting the model's
// post-call usage report:
//   1. Budget enforcement — reject prompts above maxInputTokens *before*
//      paying for an LLM call that's going to be wasted.
//   2. Early visibility — the estimated input-token count is attached to the
//      *enclosing chat span* (alongside `gen_ai.usage.input_tokens` once the
//      model responds), so cost/usage attribution still works for requests
//      that error before the LLM finishes. The attribute is set by the
//      caller on the chat span, not on the `gen_ai.tokenize` span itself,
//      so consumers can compare estimated-vs-actual within one row.
//
// Synchronous and CPU-bound on the Node.js event loop. Sized to be cheap
// relative to LLM call latency (~100-200 ms vs ~20 s end-to-end), but it
// *will* queue up behind itself if the ECS task is starved for CPU.
//
// PRODUCTION ALTERNATIVE — worker-thread offload (intentionally NOT enabled
// here because the workshop wants the tokenizer to compete with the Node
// event loop under load; that's the CPU-bound bottleneck story Module 3
// explores). For real deployments, move the synchronous countTokens call
// into a worker so the event loop isn't blocked:
//
//   // tokenizer-worker.js
//   import { parentPort } from 'node:worker_threads';
//   import { countTokens } from '@anthropic-ai/tokenizer';
//   parentPort.on('message', (text) => parentPort.postMessage(countTokens(text)));
//
//   // tokenization.js (worker variant)
//   import { Worker } from 'node:worker_threads';
//   const worker = new Worker(new URL('./tokenizer-worker.js', import.meta.url));
//   export function tokenizePromptAsync(prompt) {
//     return new Promise((resolve, reject) => {
//       worker.once('message', resolve);
//       worker.once('error', reject);
//       worker.postMessage(prompt);
//     });
//   }
//
// That version returns a promise that resolves off-thread, so the main
// thread keeps serving other requests while one is being tokenized.
export function tokenizePrompt(prompt, { modelName, maxInputTokens } = {}) {
  return tracer.startActiveSpan(
    'gen_ai.tokenize',
    {
      attributes: {
        'gen_ai.operation.name': 'tokenize',
        'gen_ai.request.model': modelName,
        'gen_ai.tokenizer.library': '@anthropic-ai/tokenizer',
      },
    },
    (span) => {
      const start = Date.now();
      try {
        const tokens = countTokens(prompt);
        span.setAttribute('duration_ms', Date.now() - start);

        if (maxInputTokens && tokens > maxInputTokens) {
          const err = new Error(
            `Input exceeds budget: ${tokens} > ${maxInputTokens} tokens`,
          );
          err.name = 'InputTokenBudgetExceeded';
          span.setAttribute('error.type', err.name);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          logger.warn('Input token budget exceeded', {
            tokens,
            maxInputTokens,
            modelName,
          });
          throw err;
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return tokens;
      } finally {
        span.end();
      }
    },
  );
}
