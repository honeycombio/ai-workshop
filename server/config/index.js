import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // LLM Configuration - Bedrock only
  llm: {
    defaultProvider: 'bedrock', // Always use Bedrock
    maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS) || 1000,

    bedrock: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Optional - only for local dev
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Optional - only for local dev
      region: process.env.AWS_REGION || 'us-east-1',
      model: process.env.BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0' // Claude 3.5 Sonnet v1
    }
  },
  
  // Vector Database Configuration
  vectorDb: {
    chromaDbPath: process.env.CHROMA_DB_PATH || './data/chroma_db',
    collectionName: process.env.CHROMA_COLLECTION_NAME || 'otel_knowledge'
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30
  }
};

// Validation
export function validateConfig() {
  // For Bedrock, credentials are optional
  // - In local development: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required
  // - In ECS: IAM task role provides credentials automatically

  // Only validate if we're NOT in an ECS environment
  const isECS = process.env.ECS_CONTAINER_METADATA_URI || process.env.AWS_EXECUTION_ENV;

  if (!isECS) {
    const requiredFields = [];
    if (!config.llm.bedrock.accessKeyId) requiredFields.push('AWS_ACCESS_KEY_ID');
    if (!config.llm.bedrock.secretAccessKey) requiredFields.push('AWS_SECRET_ACCESS_KEY');

    if (requiredFields.length > 0) {
      throw new Error(`Missing required environment variables for local development: ${requiredFields.join(', ')}`);
    }
  } else {
    console.log('Running in ECS - using IAM task role for AWS credentials');
  }
}
