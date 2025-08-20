import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // LLM Configuration
  llm: {
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
    maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS) || 1000,
    
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
    },
    
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
    },
    
    bedrock: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      model: process.env.BEDROCK_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0'
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
  const requiredFields = [];
  
  switch (config.llm.defaultProvider) {
    case 'openai':
      if (!config.llm.openai.apiKey) requiredFields.push('OPENAI_API_KEY');
      break;
    case 'anthropic':
      if (!config.llm.anthropic.apiKey) requiredFields.push('ANTHROPIC_API_KEY');
      break;
    case 'bedrock':
      if (!config.llm.bedrock.accessKeyId) requiredFields.push('AWS_ACCESS_KEY_ID');
      if (!config.llm.bedrock.secretAccessKey) requiredFields.push('AWS_SECRET_ACCESS_KEY');
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${config.llm.defaultProvider}`);
  }
  
  if (requiredFields.length > 0) {
    throw new Error(`Missing required environment variables: ${requiredFields.join(', ')}`);
  }
}
