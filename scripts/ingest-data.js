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
        title: 'Node.js Express Auto-instrumentation Setup',
        content: `# Auto-instrumenting Node.js with OpenTelemetry

## Quick Start

1. Install the required packages:
\`\`\`bash
npm install @opentelemetry/auto-instrumentations-node
npm install @opentelemetry/exporter-trace-otlp-http
\`\`\`

2. Create an instrumentation file (instrument.js):
\`\`\`javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
\`\`\`

3. Run your application with instrumentation:
\`\`\`bash
node --require ./instrument.js app.js
\`\`\`

This will automatically instrument popular Node.js libraries including Express, HTTP, and database clients.`,
        source: 'otel-docs',
        metadata: {
          type: 'setup',
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
        source: 'otel-docs',
        metadata: {
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
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');

const sdk = new NodeSDK({
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 5000,
  }),
});

sdk.start();
\`\`\``,
        source: 'otel-docs',
        metadata: {
          type: 'metrics',
          language: 'javascript',
          concept: 'observability'
        }
      },
      {
        title: 'Options for instrumenting OpenTelemetry on Node.js using LangChain',
        content: `
You’ve got a few solid paths to get OpenTelemetry (OTel) traces out of a Node.js app that uses LangChain (or LangGraph). Here are the main options, from “fastest to value” to “most control.”

1) LangChain/LangGraph + LangSmith with native OTel support

LangSmith now ingests and emits OpenTelemetry traces end-to-end. You can enable automatic instrumentation for LangChain/LangGraph and export via OTLP to LangSmith (or the other way around if LangSmith is your sink). This is the most “it just works” route if you already use LangSmith. 
LangChain Blog
+1
LangSmith

When to pick it: you’re already using LangSmith for tracing/evals and want OTel compatibility without wiring everything from scratch.

2) Community auto-instrumentation for LangChainJS

Use an OTel instrumentation package targeted at LangChainJS. The most common one is Traceloop’s:

@traceloop/instrumentation-langchain (NPM) adds spans around chains, tools, models, vector DB calls, etc., and emits standard OTel data you can send to any OTLP backend (Datadog, New Relic, Grafana, Honeycomb, etc.). 
npm
Yarn

Quick start (typical pattern):
\`\`\`javascript
// instrumentation.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { LangChainInstrumentation } from "@traceloop/instrumentation-langchain";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ /* endpoint, headers via env */ }),
  instrumentations: [
    getNodeAutoInstrumentations(),
    new LangChainInstrumentation(),
  ],
});
sdk.start();
\`\`\`

Then run your app with -r ./instrumentation.ts (or load it before your app’s entrypoint).

When to pick it: you want plug-and-play spans for LangChainJS and the freedom to send to any OTLP-compatible backend. (OTLP exporters are the standard way to ship data from OTel JS.) 
OpenTelemetry

3) DIY: OpenTelemetry JS SDK + manual spans around LangChain

Wire OTel yourself and add spans around chain.invoke, tools, retrievers, embeddings, etc.

Skeleton setup:
\`\`\`javascript
// otel.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

export const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
\`\`\`

\`\`\`javascript
// app.ts
import { trace } from "@opentelemetry/api";
import { RunnableSequence } from "@langchain/core/runnables";
// … set up your chain as usual …

const tracer = trace.getTracer("app");
const result = await tracer.startActiveSpan("chain.invoke", async (span) => {
  try {
    const out = await chain.invoke(input);
    span.setAttribute("llm.tokens", out?.usage?.total_tokens ?? 0);
    span.setAttribute("chain.name", "my_chain");
    return out;
  } finally {
    span.end();
  }
});
\`\`\`

This route uses the standard OTel Node guide, plus the contrib auto-instrumentations where helpful, and the OTLP HTTP exporter to send data to your backend (e.g., Honeycomb’s OTLP ingest). 
OpenTelemetry
+1
open-telemetry.github.io

When to pick it: you want full control over span names/attributes/links and how LangChain operations map to your service topology.

4) Vendor-specific examples built on OTel

If you’re targeting a particular backend, there are ready-made recipes showing OTel + LangChain wiring:

Microsoft/AI Foundry example exporting to Azure Application Insights. 
TECHCOMMUNITY.MICROSOFT.COM

New Relic’s step-by-step LangChain + OTel tracing tutorial. 
New Relic

Last9’s LangChain/LangGraph OTel guide (helpful patterns, tokens, state flows). 
Last9

Practical tips

Use OTLP exporters. They’re the most interoperable path to send traces to almost any observability backend. 
OpenTelemetry

Start with auto-instrumentation, then add custom spans. Let an instrumentation package capture the basics, then layer in high-value custom attributes (prompt IDs, tool names, RAG source counts, reranker scores, token usage). Patterns in the Last9 and New Relic posts are handy. 
Last9
New Relic

Keep prompts private when needed. Some instrumentations log prompts/outputs by default; turn that off (or scrub) if you handle sensitive data. (Example note from a Python package, but the privacy trade-off applies broadly.) 
PyPI

Map spans to user requests. If you’re serving HTTP, link request spans to chain/tool spans so you can see end-to-end latency and error propagation (use context propagation from the Node SDK). 
OpenTelemetry
+1

Look for community examples. There are open repos showing LangChain/LangGraph with OTel shipping to vendors like New Relic. Great for copy-pasteable config. 
GitHub

If you tell me your preferred backend (e.g., Honeycomb with OTLP HTTP endpoint, headers, and dataset), I can drop in a working config tailored to it.

        `,
        source: 'otel-docs',
        metadata: {
          type: 'instrumentation',
          language: 'javascritp',
          concept: 'observability'
        }
      },
      {
        title: 'About HNY-AI-Workshop project',
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

### Key Components
Frontend (/client)
Modern React application
Real-time chat interface
Provider selection component
Message streaming support
API service layer for backend communication

### Backend (/server)
Express.js server with modular architecture
Comprehensive middleware (auth, validation, rate limiting)
Robust error handling and logging
API routes for chat and admin functions
Service layer for business logic

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
        source: 'hny-ai-workshop',
        metadata: {
          type: 'project',
          language: 'javascript',
          concept: 'project'
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