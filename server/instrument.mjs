import 'dotenv/config';  // auto-loads .env
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(
    {
        url: 'https://api.honeycomb.io/v1/traces',
        headers: {
            'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
        }
    }
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      }
    }),
    lcInstrumentation,
  ],
});

sdk.start();
