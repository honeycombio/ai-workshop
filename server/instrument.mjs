import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(
    {
        url: 'https://api.honeycomb.io/v1/traces',
        headers: {
            'x-honeycomb-team': 'hcaik_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        }
    }
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      }
    }),
  ],
});

sdk.start();
