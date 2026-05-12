import { HoneycombWebSDK } from '@honeycombio/opentelemetry-web';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

/**
 * Initialize OpenTelemetry for the browser with Honeycomb
 * Instruments fetch/XHR calls and user interactions
 */
export function initializeTracing() {
  try {
    // Get configuration from environment variables
    const honeycombApiKey = process.env.REACT_APP_HONEYCOMB_API_KEY;
    const serviceName = process.env.REACT_APP_OTEL_SERVICE_NAME || 'otel-ai-chatbot-frontend';
    const environment = process.env.NODE_ENV || 'development';

    // Skip initialization if no Honeycomb API key
    if (!honeycombApiKey) {
      console.warn('REACT_APP_HONEYCOMB_API_KEY not set - frontend tracing disabled');
      return null;
    }

    // Initialize Honeycomb Web SDK
    const sdk = new HoneycombWebSDK({
      apiKey: honeycombApiKey,
      serviceName: serviceName,
      dataset: process.env.REACT_APP_HONEYCOMB_DATASET || serviceName,

      // Add resource attributes
      resourceAttributes: {
        'service.name': serviceName,
        'service.version': process.env.REACT_APP_VERSION || '1.0.0',
        'deployment.environment': environment,
        'service.type': 'frontend',
        'service.component': 'react-app'
      },

      // Configure instrumentations
      instrumentations: [
        // Instrument fetch API calls
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /localhost:3001/,
            new RegExp(process.env.REACT_APP_API_URL || 'localhost:3001')
          ],
          clearTimingResources: true,
          // Don't instrument health checks or static assets
          ignoreUrls: [
            /\/api\/health/,
            /\.css$/,
            /\.js$/,
            /\.png$/,
            /\.jpg$/,
            /\.svg$/
          ]
        }),
        // Instrument XMLHttpRequest (for axios)
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /localhost:3001/,
            new RegExp(process.env.REACT_APP_API_URL || 'localhost:3001')
          ]
        }),
        // Instrument user interactions (clicks)
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit']
        })
      ]
    });

    sdk.start();

    console.log('✨ OpenTelemetry frontend tracing initialized with Honeycomb');
    console.log(`📊 Service: ${serviceName}`);
    console.log(`🌍 Environment: ${environment}`);

    return sdk;

  } catch (error) {
    console.error('Failed to initialize OpenTelemetry tracing:', error);
    // Don't fail the application if tracing fails
    return null;
  }
}

export default initializeTracing;
