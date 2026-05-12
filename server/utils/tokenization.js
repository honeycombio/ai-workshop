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
//   2. Early visibility — `gen_ai.usage.input_tokens.estimated` lands on the
//      span even when the LLM call fails partway through (timeouts, 5xx),
//      so cost/usage attribution still works for errored requests.
//
// Synchronous and CPU-bound on the Node.js event loop. Sized to be cheap
// relative to LLM call latency (~100-200 ms vs ~20 s end-to-end), but it
// *will* queue up behind itself if the ECS task is starved for CPU.
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
        const durationMs = Date.now() - start;

        span.setAttributes({
          'gen_ai.usage.input_tokens.estimated': tokens,
          'duration_ms': durationMs,
        });

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
