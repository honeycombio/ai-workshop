import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import llmProvider from './llmProvider.js';
import vectorStore from './vectorStore.js';
import logger from '../config/logger.js';

class RAGService {
  constructor() {
    this.systemPrompt = `You are AI Chatbot specializing in OpenTelemetry (OTel) integration and implementation. 
Your role is to help developers understand and implement OpenTelemetry instrumentation in their applications.

## Your application architecture is as follows:
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

## Context:
You have access to comprehensive documentation about OpenTelemetry, including:
- Installation and setup guides
- Instrumentation examples for various frameworks and libraries
- Best practices and configuration options
- Troubleshooting guides
- Code snippets and examples

## Instructions:
1. Provide accurate, practical, and actionable advice based on the provided context
2. Include relevant code examples when appropriate
3. Explain concepts clearly and concisely
4. If the context doesn't contain enough information, acknowledge this and provide general guidance
5. Focus on helping users implement OTel successfully in their specific use case
6. Always prioritize official OpenTelemetry documentation and best practices

Context information:
{context}

User question: {question}

Provide a helpful, accurate response based on the context above. think deeply and verify as much as possible.:`;

    this.promptTemplate = PromptTemplate.fromTemplate(this.systemPrompt);
  }

  async generateResponse(question, providerName = null, maxContextDocs = 5) {
    try {
      logger.info(`Generating response for question: "${question}"`);

      // Create a runnable for vector search
      const vectorSearchRunnable = RunnableSequence.from([
        (input) => input.question, // Extract question from input object
        async (question) => {
          const results = await vectorStore.similaritySearchWithScore(question, maxContextDocs);
          return { 
            question,
            relevantDocs: results
          };
        },
        (input) => ({
          context: this.formatContext(input.relevantDocs),
          question: input.question,
          relevantDocs: input.relevantDocs // Pass through for metadata
        })
      ]);

      // Get LLM provider
      const llm = llmProvider.getProvider(providerName);

      // Create the complete chain
      const chain = RunnableSequence.from([
        vectorSearchRunnable,
        {
          context: (input) => input.context,
          question: (input) => input.question,
          relevantDocs: (input) => input.relevantDocs
        },
        {
          context: (input) => input.context,
          question: (input) => input.question,
          llmResponse: async (input) => {
            const response = await this.promptTemplate
              .pipe(llm)
              .pipe(new StringOutputParser())
              .invoke({
                context: input.context,
                question: input.question
              });
            return response;
          },
          relevantDocs: (input) => input.relevantDocs
        }
      ]);

      // Run the chain
      const result = await chain.invoke({
        question: question
      });

      // Format and return the response
      logger.info('Response generated successfully');
      return {
        response: result.llmResponse,
        context: {
          documentsUsed: result.relevantDocs.length,
          sources: this.extractSources(result.relevantDocs),
          relevanceScores: result.relevantDocs.map(([doc, score]) => ({
            source: doc.metadata?.source || 'unknown',
            score: score
          }))
        },
        metadata: {
          question: question,
          provider: providerName || llmProvider.getAvailableProviders()[0],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Error generating RAG response:', error);
      throw error;
    }
  }

  formatContext(relevantDocs) {
    if (!relevantDocs || relevantDocs.length === 0) {
      return 'No relevant context found in the knowledge base.';
    }

    return relevantDocs
      .map(([doc, score]) => {
        const source = doc.metadata?.source || 'unknown';
        const content = doc.pageContent;
        return `Source: ${source} (Relevance: ${score.toFixed(3)})\n${content}`;
      })
      .join('\n\n---\n\n');
  }

  extractSources(relevantDocs) {
    const sources = new Set();
    relevantDocs.forEach(([doc]) => {
      const source = doc.metadata?.source;
      if (source) {
        sources.add(source);
      }
    });
    return Array.from(sources);
  }

  async askQuestion(question, options = {}) {
    const {
      provider = null,
      maxContextDocs = 5,
      includeContext = false
    } = options;

    try {
      const result = await this.generateResponse(question, provider, maxContextDocs);
      
      if (!includeContext) {
        // Return simplified response without internal context details
        return {
          response: result.response,
          sources: result.context.sources,
          metadata: {
            provider: result.metadata.provider,
            timestamp: result.metadata.timestamp
          }
        };
      }

      return result;
    } catch (error) {
      logger.error('Error in askQuestion:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async getContextForQuestion(question, maxDocs = 5) {
    try {
      const relevantDocs = await vectorStore.similaritySearchWithScore(question, maxDocs);
      return {
        context: this.formatContext(relevantDocs),
        sources: this.extractSources(relevantDocs),
        documentCount: relevantDocs.length
      };
    } catch (error) {
      logger.error('Error getting context for question:', error);
      throw error;
    }
  }
}

export default new RAGService();
