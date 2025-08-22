import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import llmProvider from './llmProvider.js';
import vectorStore from './vectorStore.js';
import logger from '../config/logger.js';

class RAGService {
  constructor() {
    this.systemPrompt = `You are an expert assistant specializing in OpenTelemetry (OTel) integration and implementation. 
Your role is to help developers understand and implement OpenTelemetry instrumentation in their applications.

Context: You have access to comprehensive documentation about OpenTelemetry, including:
- Installation and setup guides
- Instrumentation examples for various frameworks and libraries
- Best practices and configuration options
- Troubleshooting guides
- Code snippets and examples

Instructions:
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

      // Step 1: Retrieve relevant context from vector store
      const relevantDocs = await vectorStore.similaritySearchWithScore(
        question, 
        maxContextDocs
      );

      // Step 2: Format context
      const context = this.formatContext(relevantDocs);
      
      // Step 3: Get LLM provider
      const llm = llmProvider.getProvider(providerName);

      // Step 4: Create and run the chain
      const chain = RunnableSequence.from([
        this.promptTemplate,
        llm,
        new StringOutputParser()
      ]);

      const response = await chain.invoke({
        context: context,
        question: question
      });

      // Step 5: Log and return response with metadata
      logger.info('Response generated successfully');
      
      return {
        response: response,
        context: {
          documentsUsed: relevantDocs.length,
          sources: this.extractSources(relevantDocs),
          relevanceScores: relevantDocs.map(([doc, score]) => ({
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
