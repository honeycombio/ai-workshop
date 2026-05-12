import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
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
      // Service is 'aoss' for OpenSearch Serverless, 'es' for managed domains.
      // Pulumi sets OPENSEARCH_SERVICE=aoss in production.
      const opensearchService = process.env.OPENSEARCH_SERVICE || 'aoss';
      this.serverless = opensearchService === 'aoss';
      this.indexName = process.env.OPENSEARCH_INDEX || config.vectorDb.collectionName || 'otel_knowledge';

      logger.debug('OpenSearch configuration:', {
        endpoint: opensearchEndpoint,
        indexName: this.indexName,
        service: opensearchService,
        authMethod: 'AWS SigV4 (IAM)',
      });

      // Initialize OpenSearch client with AWS SigV4 signing.
      // Serverless requires service='aoss'; managed OpenSearch uses service='es'.
      this.client = new Client({
        ...AwsSigv4Signer({
          region: process.env.AWS_REGION || 'us-east-1',
          service: opensearchService,
          getCredentials: () => {
            const credentialsProvider = defaultProvider();
            return credentialsProvider();
          },
        }),
        node: opensearchEndpoint,
        ssl: {
          rejectUnauthorized: true,
        },
      });

      // Serverless rejects the `/` info endpoint — skip the warmup ping there.
      if (!this.serverless) {
        await this.client.info();
      }
      logger.info(`Connected to OpenSearch (service=${opensearchService})`);

      // Initialize embeddings - always use Bedrock with Amazon Titan
      this.embeddings = new BedrockEmbeddings({
        model: 'amazon.titan-embed-text-v1',
        region: process.env.AWS_REGION || 'us-east-1',
        // Credentials handled automatically:
        // - ECS: Uses IAM task role
        // - Local: Uses AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY from env
      });
      logger.info('Using Bedrock embeddings with Amazon Titan');

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
        // Build settings/mappings. Serverless vector collections reject the
        // `knn` index setting and `ef_search` param — the engine handles those
        // implicitly. Managed domains still need them.
        const indexBody = {
          mappings: {
            properties: {
              content: { type: 'text' },
              embedding: {
                type: 'knn_vector',
                dimension: 1536, // Amazon Titan Text Embeddings dimension
                method: {
                  name: 'hnsw',
                  space_type: 'l2',
                  engine: 'faiss',
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
        };
        if (!this.serverless) {
          indexBody.settings = {
            index: {
              knn: true,
              'knn.algo_param.ef_search': 100,
            },
          };
        }
        await this.client.indices.create({
          index: this.indexName,
          body: indexBody,
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

      // Bulk index. Serverless rejects the `refresh` parameter (it's
      // eventually consistent and refreshes automatically); managed domains
      // honour it.
      if (bulkBody.length > 0) {
        const bulkArgs = { body: bulkBody };
        if (!this.serverless) {
          bulkArgs.refresh = true;
        }
        const response = await this.client.bulk(bulkArgs);

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
      // Serverless doesn't expose _stats — use _count instead and report size
      // as unknown. Managed OpenSearch returns full stats.
      if (this.serverless) {
        const countResp = await this.client.count({ index: this.indexName });
        return {
          indexName: this.indexName,
          initialized: this.initialized,
          documentCount: countResp.body.count,
          sizeInBytes: null,
        };
      }
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
