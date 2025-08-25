import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document } from '@langchain/core/documents';
import dotenv from 'dotenv';

// Import our services
import vectorStore from '../server/services/vectorStore.js';
import logger from '../server/config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class DataIngestionService {
  constructor() {
    this.sampleDocuments = [
      {
        title: 'Node.js Express OpenTelemetry Auto-instrumentation Setup for Honeycomb',
        content: `# Auto-instrumenting Node.js with OpenTelemetry

## Quick Start

1. Install the required packages:
\`\`\`bash
npm install @opentelemetry/auto-instrumentations-node
npm install @opentelemetry/exporter-trace-otlp-http
\`\`\`

2. Create an instrumentation file (instrument.mjs) in ./server directory:
\`\`\`javascript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
    headers: {
      'x-honeycomb-team': 'hcaik_xxxxxxxxxxxxxxxxxxxxxxx',  // replace with your honeycomb ingest key
      'x-honeycomb-dataset': 'otel-ai-chatbot',
  }),
  instrumentations: [getNodeAutoInstrumentations(
    '@opentelemetry/instrumentation-fs': {
        enabled: false,
    },
  )],
});

sdk.start();
\`\`\`

3. Run your application with instrumentation:
\`\`\`bash
node --require ./server/instrument.mjs server/index.js
\`\`\`

This will automatically instrument popular Node.js libraries including Express, HTTP, and database clients.`,
        source: 'otel-docs-node-instrumentation',
        metadata: {
          search: 'all',
          type: 'instrumentation',
          language: 'javascript',
          framework: 'express'
        }
      },
      {
        title: 'Custom Span Creation in Node.js',
        content: `# Creating Custom Spans

## Manual Span Creation

\`\`\`javascript
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('my-service', '1.0.0');

async function processOrder(order) {
  const span = tracer.startSpan('process-order');
  
  try {
    span.setAttributes({
      'order.id': order.id,
      'order.value': order.value,
      'user.id': order.userId
    });
    
    // Your business logic here
    const result = await performOrderProcessing(order);
    
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
\`\`\``,
        source: 'otel-docs-instrumentation',
        metadata: {
          search: 'all',
          type: 'manual-instrumentation',
          language: 'javascript',
          concept: 'spans'
        }
      },
      {
        title: 'OpenTelemetry Metrics in Node.js',
        content: `# Collecting Metrics with OpenTelemetry

## Setup Metrics

\`\`\`javascript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

const sdk = new NodeSDK({
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://api.honeycomb.io:4318/v1/metrics',
      headers: {
        'x-honeycomb-team': 'hcaik_xxxxxxxxxxxxxxxxxxxxxxx',  // replace with your honeycomb ingest key
        'x-honeycomb-dataset': 'your_dataset_name'            // replace with your dataset name
      },
    }),
    exportIntervalMillis: 5000,
  }),
});

sdk.start();
\`\`\``,
        source: 'otel-docs-instrumentation-metrics',
        metadata: {
          search: 'all',
          type: 'metrics',
          language: 'javascript',
          concept: 'observability'
        }
      },
      {
        title: 'Instrumenting LangChain with OpenTelemetry for Node.js',
        content: `
# Instrumenting LangChain with OpenTelemetry
## Overview
This guide provides options for instrumenting LangChainJS applications with OpenTelemetry to capture detailed traces LLM operations, tools, and retrievers.

## Instruction for instrumentation
1) Install LangChainJS OpenTelemetry Instrumentation Package
This package provides automatic instrumentation for LangChainJS, capturing spans for chains, tools, and retrievers.
\`\`\`bash
npm install @arizeai/openinference-instrumentation-langchain
\`\`\`

2) Add the following code to server/instrumentation.mjs to set up the instrumentation:
\`\`\`javascript
// instrumentation.mjs
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
    headers: {
      'x-honeycomb-team': 'hcaik_xxxxxxxxxxxxxxxxxxxxxxx',  // replace with your honeycomb ingest key
    },
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // We recommend disabling fs automatic instrumentation because 
      // it can be noisy and expensive during startup
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
    lcInstrumentation,
  ],
});
sdk.start();
\`\`\`

3) Run your application with the instrumentation file:
Then run your app with node --require ./server/instrumentation.mjs server/index.js (or load it before your app’s entrypoint).

## Practical tips
- Use OTLP exporters. They’re the most interoperable path to send traces to almost any observability backend. 
- Start with auto-instrumentation, then add custom spans. Let an instrumentation package capture the basics, then layer in high-value custom attributes (prompt IDs, tool names, RAG source counts, reranker scores, token usage). 
- Keep prompts private when needed. Some instrumentations log prompts/outputs by default; turn that off (or scrub) if you handle sensitive data. (Example note from a Python package, but the privacy trade-off applies broadly.) 
- Map spans to user requests. If you’re serving HTTP, link request spans to chain/tool spans so you can see end-to-end latency and error propagation (use context propagation from the Node SDK).
- Look for community examples. There are open repos showing LangChain/LangGraph with OTel shipping to vendors like New Relic. Great for copy-pasteable config. 

        `,
        source: 'otel-docs-langchain-instrumentation',
        metadata: {
          search: 'all',
          type: 'instrumentation-langchain',
          language: 'javascritp',
          concept: 'observability'
        }
      },
      {
        title: 'OpenTelemetry Documentation',
        source: 'otel-docs-react-web-instrumentation',
        metadata: {
          search: 'all',
          type: 'instrumentation-react-web',
          language: 'javascript',
          concept: 'observability'
        },
        content: `
# Instrumenting React Web Applications with OpenTelemetry
## Overview
This guide provides options for instrumenting React web applications with OpenTelemetry to capture detailed traces of user.

## Instruction for instrumentation
1) Install OpenTelemetry packages:
You must install the HFO (Honeycomb Frontend Observability) and required web auto-instrumentation packages in your React application. Run the following commands in your client directory:
\`\`\`bash
cd client
npm install --save @honeycombio/opentelemetry-web
npm install --save @opentelemetry/auto-instrumentations-web
\`\`\`

2) Create observability.jsx file
Create a new file named observability.jsx in your client/src/components directory with the following content:
\`\`\`javascript
import { HoneycombWebSDK } from '@honeycombio/opentelemetry-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

const configDefaults = {
  ignoreNetworkEvents: true,
  // propagateTraceHeaderCorsUrls: [
  // /.+/g, // Regex to match your backend URLs. Update to the domains you wish to include.
  // ]
}
export default function Observability(){
  try {
    const sdk = new HoneycombWebSDK({
      // endpoint: "https://api.eu1.honeycomb.io/v1/traces", // Send to EU instance of Honeycomb. Defaults to sending to US instance.
      debug: true, // Set to false for production environment.
      apiKey: 'hcaik_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with your Honeycomb Ingest API Key.
      serviceName: 'chatbot-client', // Replace with your application name. Honeycomb uses this string to find your dataset when we receive your data. When no matching dataset exists, we create a new one with this name if your API Key has the appropriate permissions.
      instrumentations: [getWebAutoInstrumentations({
        // Loads custom configuration for xml-http-request instrumentation.
        '@opentelemetry/instrumentation-xml-http-request': configDefaults,
        '@opentelemetry/instrumentation-fetch': configDefaults,
        '@opentelemetry/instrumentation-document-load': configDefaults,
      })],
    });
    sdk.start();
  } catch (e) {return null;}
  return null;
}
\`\`\`

3) Import and use the Observability component
In your main application file (src/App.js), import and use the Observability component:
\`\`\`javascript
import React from 'react';
...
import Observability from './components/observability';

...
function App() {
  return (
    <AppContainer>
      <GlobalStyle />
      <ChatInterface />
      <Observability />
    </AppContainer>
  );
}

export default App;
\`\`\`
4) Run your React application
Run your React application as usual:

`,
      },
      {
        title: 'About AI-Workshop project (OpenTelemetry AI Chatbot)',
        content: `
# Project Overview
This is an AI-powered chatbot application specifically designed to help developers with OpenTelemetry integration and instrumentation. It's a full-stack JavaScript/Node.js application that combines modern web technologies with AI capabilities.

## Core Features
### Multi-LLM Support
Supports multiple AI providers: OpenAI, Anthropic Claude, and AWS Bedrock
Allows easy switching between providers
Implements provider-agnostic chat interface

## RAG (Retrieval Augmented Generation) Capabilities
Uses ChromaDB as vector database
Pre-loaded with OpenTelemetry documentation
Provides contextually relevant answers based on stored knowledge
Supports source attribution for responses

## Modern Architecture
React-based frontend
Express.js backend
Real-time streaming responses
Vector search integration
Comprehensive API endpoints

## Technical Architecture

+------------------------+
|     React Frontend     |
|  +------------------+ |
|  |   Chat Interface | |
|  |  Provider Select | |
|  | Message Streaming| |
|  +--------+--------+ |
+-----------|-----------+
            |
            v
+------------------------+
|    Express Backend     |
| +--------------------+|
| |    API Layer       ||
| |       |            ||
| |    Auth/Rate Limit ||
| |    /          \    ||
| | LLM         Vector ||
| |Service      Store  ||
| |    \          /    ||
| |     RAG Service    ||
| +--------------------+|
+-----|-----------^-----+
      |           |
      v           |
+------------------------+
|  External Services     |
| +---------+  +------+ |
| | ChromaDB|  |OpenAI| |
| +---------+  +------+ |
| +----------+ +------+ |
| |  Claude  | |AWS   | |
| |          | |Bedrock| |
| +----------+ +------+ |
+------------------------+

Legend:
→ Data flow
↔ Bidirectional communication

### Frontend
Frontend (/client)
Modern React application
Real-time chat interface
Provider selection component
Message streaming support
API service layer for backend communication

#### Key Dependencies of Frontend
The project is using modern JavaScript (ES6+) with JSX syntax
Modern ES6+ module imports/exports
react-router-dom (v6.20.1) for routing
axios (v1.6.2) for HTTP requests
react-markdown (v9.0.1) for markdown rendering
react-syntax-highlighter (v15.5.0) for code highlighting
react-icons (v4.12.0) for icon components
OpenTelemetry related packages for web monitoring

### Backend (/server)
Express.js server with modular architecture
Comprehensive middleware (auth, validation, rate limiting)
Robust error handling and logging
API routes for chat and admin functions
Service layer for business logic

#### Key Dependencies of Backend
Node.js with Express.js framework
Uses ES Modules (type: "module" in package.json)
Modern JavaScript (ES6+) with async/await patterns
Class-based architecture for server setup
LangChain ecosystem (@langchain/core, @langchain/openai, etc.)
ChromaDB for vector storage
Express middleware (cors, helmet, rate-limit)
Winston for logging
Various AI provider SDKs (OpenAI, Anthropic, AWS)

### Services
llmProvider.js: Manages multiple AI provider integrations
vectorStore.js: Handles ChromaDB interactions
ragService.js: Implements RAG functionality
Various middleware services for security and validation

### Data Management
Uses ChromaDB for vector storage
Includes data ingestion scripts
Supports custom documentation ingestion
Pre-loaded with OpenTelemetry documentation

### Development Features
Development Tools
Hot reloading for development
Comprehensive logging
Environment-based configuration
Debug mode support

### Security Features
API key validation
Rate limiting
CORS protection
Helmet security headers

### Deployment Options
Development and production modes
Environment variable configuration
Static file serving for production
Health check endpoints

### Getting Started
Prerequisites
Node.js 18+
npm or yarn
API keys for chosen LLM providers
ChromaDB for vector storage

### Setup Process
all

### API Endpoints
Chat API
POST /api/chat: Send messages
GET /api/chat/context: Get context
GET /api/chat/providers: List providers
POST /api/chat/test-provider: Test provider

### Admin API
POST /api/admin/ingest: Add documents
GET /api/admin/vector-store/info: Get store info
POST /api/admin/search: Search documents
DELETE /api/admin/vector-store: Reset store

## This project is particularly valuable for developers working with OpenTelemetry, as it provides an interactive way to learn about and implement OpenTelemetry instrumentation in their applications. The combination of multiple LLM providers and RAG capabilities ensures high-quality, contextually relevant responses to technical queries about OpenTelemetry implementation.
        `,
        source: 'ai-workshop',
        metadata: {
          search: 'all',
          type: 'project overview',
          language: 'javascript',
          concept: 'project'
        }
      },
      {
        title: 'How to instrument me, the otel-ai-chatbot application to Honeycomb',
        content: `
# How to instrument me, the otel-ai-chatbot application

## Overview
This guide provides options for instrumenting myself, the otel-ai-chatbot application, with OpenTelemetry to capture detailed traces of user interactions, to Honeycomb.

## Instruction for instrumentation
1) Install OpenTelemetry packages in your client directory:
You must install the HFO (Honeycomb Frontend Observability) and required web auto-instrumentation packages in your React application. Run the following commands in your client directory:
\`\`\`bash
cd client
npm install --save @honeycombio/opentelemetry-web
npm install --save @opentelemetry/auto-instrumentations-web
\`\`\`


2) Create observability.jsx file
Create a new file named observability.jsx in your client/src/components directory with the following content:
\`\`\`javascript
import { HoneycombWebSDK } from '@honeycombio/opentelemetry-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

const configDefaults = {
  ignoreNetworkEvents: true,
  // propagateTraceHeaderCorsUrls: [
  // /.+/g, // Regex to match your backend URLs. Update to the domains you wish to include.
  // ]
}
export default function Observability(){
  try {
    const sdk = new HoneycombWebSDK({
      // endpoint: "https://api.eu1.honeycomb.io/v1/traces", // Send to EU instance of Honeycomb. Defaults to sending to US instance.
      debug: true, // Set to false for production environment.
      apiKey: 'hcaik_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with your Honeycomb Ingest API Key.
      serviceName: 'chatbot-client', // Replace with your application name. Honeycomb uses this string to find your dataset when we receive your data. When no matching dataset exists, we create a new one with this name if your API Key has the appropriate permissions.
      instrumentations: [getWebAutoInstrumentations({
        // Loads custom configuration for xml-http-request instrumentation.
        '@opentelemetry/instrumentation-xml-http-request': configDefaults,
        '@opentelemetry/instrumentation-fetch': configDefaults,
        '@opentelemetry/instrumentation-document-load': configDefaults,
      })],
    });
    sdk.start();
  } catch (e) {return null;}
  return null;
}
\`\`\`

3) Import and use the Observability component
In your main application file (src/App.js), import and use the Observability component:
\`\`\`javascript
import React from 'react';
...
import Observability from './components/observability';

...
function App() {
  return (
    <AppContainer>
      <GlobalStyle />
      <ChatInterface />
      <Observability />
    </AppContainer>
  );
}

export default App;
\`\`\`

4) Run your React application
Rerun your React application as usual:
\`\`\`bash
npm run stop:all
scripts/quick-start.sh
\`\`\`

        `,
        source: 'how-to-instrument-otel-ai-chatbot',
        metadata: {
          search: 'all',
          type: 'how-to',
          language: 'javascript',
          concept: 'instrumentation'
        }
      }
    ];
  }

  async processDocument(doc, index) {
    const documentId = `doc-${Date.now()}-${index}`;
    
    return new Document({
      pageContent: doc.content,
      metadata: {
        id: documentId,
        title: doc.title,
        source: doc.source,
        ingestedAt: new Date().toISOString(),
        document_id: documentId,  // Required by ChromaDB
        ...doc.metadata
      }
    });
  }

  async ingestSampleDocuments() {
    try {
      logger.info('Starting ingestion of sample OpenTelemetry documents...');

      // Process documents with unique IDs
      const documents = await Promise.all(
        this.sampleDocuments.map((doc, index) => this.processDocument(doc, index))
      );

      // Add documents to vector store
      const totalChunks = await vectorStore.addDocuments(documents);
      
      logger.info(`Successfully ingested ${documents.length} documents (${totalChunks} chunks) into vector store`);
      
      return {
        documentsIngested: documents.length,
        chunksCreated: totalChunks
      };

    } catch (error) {
      logger.error('Error ingesting sample documents:', error);
      throw error;
    }
  }

  async saveDocumentsToFile() {
    try {
      const docsPath = path.join(__dirname, '../data/sample-otel-docs.json');
      await fs.writeFile(docsPath, JSON.stringify(this.sampleDocuments, null, 2));
      logger.info(`Sample documents saved to ${docsPath}`);
    } catch (error) {
      logger.error('Error saving documents to file:', error);
      throw error;
    }
  }

  async run() {
    try {
      logger.info('🚀 Starting OpenTelemetry documentation ingestion...');

      // Ensure data directory exists
      const dataDir = path.join(__dirname, '../data');
      await fs.mkdir(dataDir, { recursive: true });

      // Save sample documents to file for reference
      await this.saveDocumentsToFile();

      // Initialize vector store
      await vectorStore.initialize();

      // Delete existing collection if it exists
      await vectorStore.deleteCollection().catch(() => {});

      // Re-initialize vector store with clean state
      await vectorStore.initialize();

      // Ingest sample documents
      const result = await this.ingestSampleDocuments();

      logger.info('✅ Data ingestion completed successfully!');
      logger.info(`📊 Summary: ${result.documentsIngested} documents, ${result.chunksCreated} chunks`);

      return result;

    } catch (error) {
      logger.error('❌ Data ingestion failed:', error);
      throw error;
    }
  }
}

// Run the ingestion if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const ingestionService = new DataIngestionService();
  
  ingestionService.run()
    .then((result) => {
      console.log('✅ Ingestion completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ingestion failed:', error);
      process.exit(1);
    });
}

export default DataIngestionService;