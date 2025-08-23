import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { BedrockEmbeddings } from '@langchain/aws';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { config } from '../config/index.js';
import logger from '../config/logger.js';

class VectorStoreService {
  constructor() {
    this.vectorStore = null;
    this.embeddings = null;
    this.textSplitter = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Initialize embeddings
      if (config.llm.defaultProvider === 'openai' || config.llm.defaultProvider === 'anthropic') {
        this.embeddings = new OpenAIEmbeddings({
          openAIApiKey: config.llm.openai.apiKey,
          modelName: 'text-embedding-ada-002'
        });
      } else if (config.llm.defaultProvider === 'bedrock') {
        this.embeddings = new BedrockEmbeddings({
          model: 'amazon.titan-embed-text-v1',
          region: config.llm.bedrock.region,
          credentials: {
            accessKeyId: config.llm.bedrock.accessKeyId,
            secretAccessKey: config.llm.bedrock.secretAccessKey
          }
        })
      } else {
        throw new Error(`Unsupported LLM provider: ${config.default.llm.provider}`);
      }

      // Initialize text splitter
      this.textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,  // Reduced chunk size
        chunkOverlap: 50,  // Reduced overlap
        separators: ["\n\n", "\n", " ", ""] // Keep standard separators
      });

      try {
        // Try to create a new collection
        this.vectorStore = await Chroma.fromDocuments(
          [], // Empty initial documents
          this.embeddings,
          {
            collectionName: config.vectorDb.collectionName,
            url: 'http://localhost:8000',
          }
        );
        this.initialized = true;
        logger.info('Vector store initialized with new collection');
      } catch (error) {
        // If collection exists, try to connect to it
        this.vectorStore = await Chroma.fromExistingCollection(
          this.embeddings,
          {
            collectionName: config.vectorDb.collectionName,
            url: 'http://localhost:8000',
          }
        );
        this.initialized = true;
        logger.info('Connected to existing vector store collection');
      }
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async addDocuments(documents) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Process each document
      const processedDocs = [];
      
      for (const doc of documents) {
        // Split text into chunks
        const textChunks = await this.textSplitter.splitText(doc.pageContent);
        
        // Create documents from chunks
        const docs = textChunks.map((chunk, index) => {
          return new Document({
            pageContent: chunk,
            metadata: {
              ...doc.metadata,
              chunk_index: index,
              chunk_total: textChunks.length,
              chunk_size: chunk.length,
              document_id: doc.metadata.id || `doc-${Date.now()}-${index}`,
            }
          });
        });
        
        processedDocs.push(...docs);
      }

      // Add documents to vector store
      if (processedDocs.length > 0) {
        await this.vectorStore.addDocuments(processedDocs);
        logger.info(`Added ${processedDocs.length} chunks to vector store`);
      }

      return processedDocs.length;
    } catch (error) {
      logger.error('Error adding documents to vector store:', error);
      throw error;
    }
  }

  async similaritySearch(query, k = 5) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      logger.debug(`Found ${results.length} similar documents for query: "${query}"`);
      return results;
    } catch (error) {
      logger.error('Error performing similarity search:', error);
      throw error;
    }
  }

  async similaritySearchWithScore(query, k = 5) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Using the vectorStore's underlying client for direct search
      const queryEmbedding = await this.embeddings.embedQuery(query);
      /*
      const col = await this.vectorStore.ensureCollection();
      const results = await col.query({
        queryEmbeddings: [queryEmbedding],
        k,
      });
      logger.info(`Found ${results.ids?.length} similar documents with scores for query: "${query}"`);
      const tuples = (results.ids?.[0] || []).map((_, i) => [
        new Document({
          pageContent: results.documents?.[0]?.[i] || "",
          metadata: results.metadatas?.[0]?.[i] || {},
        }),
        results.distances?.[0]?.[i] || 0,
      ]);

      return tuples;
      */
      /*
      if ('filter' in this.vectorStore && this.vectorStore.filter && !Object.keys(this.vectorStore.filter).length) {
        // remove accidental empty filter {}
        // @ts-ignore
        delete this.vectorStore.filter;
      }
      */
      logger.info(`vectorStore filter: ${JSON.stringify(this.vectorStore.filter)}`);
      const results = await this.vectorStore.similaritySearchVectorWithScore(queryEmbedding, k, { search: "all" });
      logger.info(`Found ${results.length} similar documents with scores for query: "${query}"`);
      return results;
    } catch (error) {
      logger.error('Error performing similarity search with scores:', error);
      throw error;
    }
  }

  async deleteCollection() {
    if (!this.initialized) {
      return;
    }

    try {
      await this.vectorStore.delete();
      this.initialized = false;
      logger.info('Vector store collection deleted');
    } catch (error) {
      logger.error('Error deleting vector store collection:', error);
      throw error;
    }
  }

  async getCollectionInfo() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return {
        collectionName: config.vectorDb.collectionName,
        initialized: this.initialized
      };
    } catch (error) {
      logger.error('Error getting collection info:', error);
      throw error;
    }
  }
}

export default new VectorStoreService();