import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { OpenAIEmbeddings } from '@langchain/openai';
import { BedrockEmbeddings } from '@langchain/aws';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { config } from '../config/index.js';
import logger from '../config/logger.js';

class OpenSearchVectorStore {
  constructor() {
    this.client = null;
    this.embeddings = null;
    this.textSplitter = null;
    this.indexName = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Get OpenSearch configuration from environment
      const opensearchEndpoint = process.env.OPENSEARCH_ENDPOINT || 'https://localhost:9200';
      this.indexName = process.env.OPENSEARCH_INDEX || config.vectorDb.collectionName || 'otel_knowledge';

      // Extract region from OpenSearch endpoint (e.g., vpc-xxx.us-east-1.es.amazonaws.com)
      const region = opensearchEndpoint.match(/\.([a-z]+-[a-z]+-\d+)\.es\.amazonaws\.com/)?.[1] || process.env.AWS_REGION || 'us-east-1';

      logger.info(`Initializing OpenSearch client with AWS SigV4 auth for region: ${region}`);

      // Initialize OpenSearch client with AWS SigV4 signing
      this.client = new Client({
        ...AwsSigv4Signer({
          region: region,
          service: 'es',
          getCredentials: () => {
            const credentialsProvider = defaultProvider();
            return credentialsProvider();
          },
        }),
        node: opensearchEndpoint,
      });

      // Test connection
      await this.client.info();
      logger.info('Connected to OpenSearch with AWS SigV4 authentication');

      // Initialize embeddings
      if (config.llm.defaultProvider === 'openai' || config.llm.defaultProvider === 'anthropic') {
        this.embeddings = new OpenAIEmbeddings({
          openAIApiKey: config.llm.openai.apiKey,
          modelName: 'text-embedding-ada-002',
        });
      } else if (config.llm.defaultProvider === 'bedrock') {
        this.embeddings = new BedrockEmbeddings({
          model: 'amazon.titan-embed-text-v1',
          region: config.llm.bedrock.region,
          credentials: {
            accessKeyId: config.llm.bedrock.accessKeyId,
            secretAccessKey: config.llm.bedrock.secretAccessKey,
          },
        });
      } else {
        throw new Error(`Unsupported LLM provider: ${config.llm.defaultProvider}`);
      }

      // Initialize text splitter
      this.textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
        separators: ["\n\n", "\n", " ", ""],
      });

      // Create index if it doesn't exist
      await this.createIndexIfNotExists();

      this.initialized = true;
      logger.info('OpenSearch vector store initialized');
    } catch (error) {
      logger.error('Failed to initialize OpenSearch vector store:', error);
      throw error;
    }
  }

  async createIndexIfNotExists() {
    try {
      const indexExists = await this.client.indices.exists({ index: this.indexName });

      if (!indexExists.body) {
        // Create index with k-NN settings
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              index: {
                knn: true, // Enable k-NN
                "knn.algo_param.ef_search": 100, // Improves recall at the cost of latency
              },
            },
            mappings: {
              properties: {
                content: { type: 'text' },
                embedding: {
                  type: 'knn_vector',
                  dimension: 1536, // OpenAI text-embedding-ada-002 dimension
                  method: {
                    name: 'hnsw',
                    space_type: 'l2',
                    engine: 'nmslib',
                    parameters: {
                      ef_construction: 128,
                      m: 24,
                    },
                  },
                },
                metadata: { type: 'object', enabled: true },
                timestamp: { type: 'date' },
              },
            },
          },
        });
        logger.info(`Created OpenSearch index: ${this.indexName}`);
      } else {
        logger.info(`OpenSearch index already exists: ${this.indexName}`);
      }
    } catch (error) {
      logger.error('Error creating OpenSearch index:', error);
      throw error;
    }
  }

  async addDocuments(documents) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const processedDocs = [];

      for (const doc of documents) {
        // Split text into chunks
        const textChunks = await this.textSplitter.splitText(doc.pageContent);

        // Create documents from chunks
        for (let index = 0; index < textChunks.length; index++) {
          const chunk = textChunks[index];
          const chunkDoc = new Document({
            pageContent: chunk,
            metadata: {
              ...doc.metadata,
              chunk_index: index,
              chunk_total: textChunks.length,
              chunk_size: chunk.length,
              document_id: doc.metadata.id || `doc-${Date.now()}-${index}`,
            },
          });
          processedDocs.push(chunkDoc);
        }
      }

      // Generate embeddings and index documents
      const bulkBody = [];
      for (const doc of processedDocs) {
        // Generate embedding
        const embedding = await this.embeddings.embedQuery(doc.pageContent);

        // Add index action
        bulkBody.push({ index: { _index: this.indexName } });

        // Add document
        bulkBody.push({
          content: doc.pageContent,
          embedding: embedding,
          metadata: doc.metadata,
          timestamp: new Date().toISOString(),
        });
      }

      // Bulk index
      if (bulkBody.length > 0) {
        const response = await this.client.bulk({
          refresh: true,
          body: bulkBody,
        });

        if (response.body.errors) {
          const erroredDocuments = [];
          response.body.items.forEach((action, i) => {
            const operation = Object.keys(action)[0];
            if (action[operation].error) {
              erroredDocuments.push({
                status: action[operation].status,
                error: action[operation].error,
                document: bulkBody[i * 2 + 1],
              });
            }
          });
          logger.error('Bulk indexing had errors:', erroredDocuments);
        }

        logger.info(`Indexed ${processedDocs.length} chunks to OpenSearch`);
      }

      return processedDocs.length;
    } catch (error) {
      logger.error('Error adding documents to OpenSearch:', error);
      throw error;
    }
  }

  async similaritySearch(query, k = 5) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Perform k-NN search
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: k,
          query: {
            knn: {
              embedding: {
                vector: queryEmbedding,
                k: k,
              },
            },
          },
        },
      });

      const results = response.body.hits.hits.map((hit) => {
        return new Document({
          pageContent: hit._source.content,
          metadata: hit._source.metadata || {},
        });
      });

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
      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Perform k-NN search
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: k,
          query: {
            knn: {
              embedding: {
                vector: queryEmbedding,
                k: k,
              },
            },
          },
        },
      });

      const results = response.body.hits.hits.map((hit) => {
        const doc = new Document({
          pageContent: hit._source.content,
          metadata: hit._source.metadata || {},
        });
        // OpenSearch returns a score, higher is better
        // Convert to distance-like metric (lower is better) for consistency with ChromaDB
        const score = 1 - (hit._score || 0);
        return [doc, score];
      });

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
      await this.client.indices.delete({ index: this.indexName });
      this.initialized = false;
      logger.info('OpenSearch index deleted');
    } catch (error) {
      logger.error('Error deleting OpenSearch index:', error);
      throw error;
    }
  }

  async getCollectionInfo() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const stats = await this.client.indices.stats({ index: this.indexName });
      return {
        indexName: this.indexName,
        initialized: this.initialized,
        documentCount: stats.body._all.primaries.docs.count,
        sizeInBytes: stats.body._all.primaries.store.size_in_bytes,
      };
    } catch (error) {
      logger.error('Error getting collection info:', error);
      throw error;
    }
  }
}

export default new OpenSearchVectorStore();
