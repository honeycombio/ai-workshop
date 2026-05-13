import { NodeSDK, logs } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// Note: DO NOT import logger here - Winston must be imported AFTER instrumentation is set up

/**
 * Initialize OpenTelemetry tracing and logging
 * This must be called before any other imports to ensure proper instrumentation
 *
 * Architecture: App → ADOT collector sidecar (localhost:4318) → Honeycomb + AWS X-Ray
 * The ADOT collector handles authentication for both backends (Honeycomb API key
 * and SigV4 for X-Ray), so the app only needs to send plain OTLP to localhost.
 *
 * Logs are sent to both:
 * - CloudWatch: Via console output captured by ECS
 * - Honeycomb: Via ADOT collector → OTLP
 *
 * Traces are sent to both:
 * - Honeycomb: Via ADOT collector → OTLP
 * - AWS X-Ray: Via ADOT collector → OTLP with SigV4 auth
 *
 * Configuration via environment variables:
 * - OTEL_SERVICE_NAME: Service name for traces and logs
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint (http://localhost:4318 in ECS)
 * - OTEL_EXPORTER_OTLP_PROTOCOL: Protocol to use (http/protobuf)
 * - SERVICE_VERSION: Git short SHA — surfaces as service.version on every span.
 * - CONTAINER_IMAGE_NAME / _TAG / _ID: OTel container.image.* resource attributes.
 *   Set by Pulumi at deploy time from the built dockerBuild.Image resource.
 */
export function initializeTracing() {
  try {
    // Enable OpenTelemetry diagnostic logging for debugging
    // Set to DEBUG to see detailed information about what's being exported
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

    const serviceName = process.env.OTEL_SERVICE_NAME || 'otel-ai-chatbot';
    // SERVICE_VERSION is the git short SHA, injected by Pulumi at deploy time
    // (see pulumi/index.ts). Falls back to package.json for local dev.
    const serviceVersion = process.env.SERVICE_VERSION || process.env.npm_package_version || '1.0.0';
    const environment = process.env.NODE_ENV || 'development';

    // Build identity from the container image — also injected by Pulumi. Surfaces
    // on every span as OTel container.image.* resource attributes so observed
    // behaviour is correlatable with the exact artifact running. Each is optional
    // so local `npm start` outside ECS still works.
    const containerImageName = process.env.CONTAINER_IMAGE_NAME;
    const containerImageTag = process.env.CONTAINER_IMAGE_TAG;
    const containerImageId = process.env.CONTAINER_IMAGE_ID;

    // Check if OTLP endpoint is configured
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const otlpHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
    const honeycombApiKey = process.env.HONEYCOMB_API_KEY;

    // Skip initialization if no configuration is provided
    if (!otlpEndpoint && !honeycombApiKey) {
      console.warn('[OpenTelemetry] No OTLP endpoint or Honeycomb API key configured - tracing disabled');
      return null;
    }

    // Initialize OTLP exporters (read from environment variables)
    const traceExporter = new OTLPTraceExporter();
    const logExporter = new OTLPLogExporter();

    // Debug: Log the exporter configuration
    console.log('[OpenTelemetry] 🔍 Exporter Configuration:');
    console.log(`[OpenTelemetry]   OTLP Endpoint: ${otlpEndpoint}`);
    console.log(`[OpenTelemetry]   OTLP Protocol: ${process.env.OTEL_EXPORTER_OTLP_PROTOCOL}`);
    console.log(`[OpenTelemetry]   Headers configured: ${otlpHeaders ? 'Yes' : 'No'}`);
    console.log(`[OpenTelemetry]   Honeycomb Dataset: ${process.env.HONEYCOMB_DATASET || 'not set'}`);

    // Initialize OpenTelemetry SDK with auto-instrumentations
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
        'service.type': 'backend',
        'service.component': 'ai-chatbot',
        // OTel semconv container.image.* — only emitted when Pulumi-injected.
        ...(containerImageName && { 'container.image.name': containerImageName }),
        ...(containerImageTag && { 'container.image.tags': [containerImageTag] }),
        ...(containerImageId && { 'container.image.id': containerImageId }),
      }),
      traceExporter: traceExporter,
      // Wrap log exporter in BatchLogRecordProcessor for proper export
      logRecordProcessors: [new logs.BatchLogRecordProcessor(logExporter)],
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation (can be noisy)
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          // Configure HTTP instrumentation to ignore health checks
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (req) => {
              return req.url === '/api/health';
            }
          }
        }),
        // Winston instrumentation to capture logs and send to Honeycomb
        new WinstonInstrumentation()
      ]
    });

    sdk.start();

    console.log('[OpenTelemetry] ✨ Tracing and logging initialized');
    console.log(`[OpenTelemetry] 📊 Service: ${serviceName}`);
    console.log(`[OpenTelemetry] 🌍 Environment: ${environment}`);
    console.log(`[OpenTelemetry] 🔗 Endpoint: ${otlpEndpoint || 'default'}`);
    console.log('[OpenTelemetry] 📝 Logs will be sent to both CloudWatch and Honeycomb');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      try {
        await sdk.shutdown();
        console.log('[OpenTelemetry] Tracing terminated');
      } catch (error) {
        console.error('[OpenTelemetry] Error terminating tracing:', error);
      } finally {
        process.exit(0);
      }
    });

    return sdk;

  } catch (error) {
    console.error('[OpenTelemetry] Failed to initialize tracing:', error);
    // Don't fail the application if tracing fails
    return null;
  }
}

export default initializeTracing;
