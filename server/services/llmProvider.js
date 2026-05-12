import { ChatBedrockConverse } from '@langchain/aws';
import { config } from '../config/index.js';
import logger from '../config/logger.js';

class LLMProviderService {
  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    try {
      // Initialize Bedrock - always use Claude Sonnet 4.5
      this.providers.set('bedrock', new ChatBedrockConverse({
        model: config.llm.bedrock.model,
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens,
        region: config.llm.bedrock.region,
        // Credentials handled automatically:
        // - ECS: Uses IAM task role
        // - Local: Uses AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY from env
      }));
      logger.info(`Bedrock provider initialized with model: ${config.llm.bedrock.model}`);

    } catch (error) {
      logger.error('Error initializing Bedrock provider:', error);
      throw error;
    }
  }

  getProvider(providerName = config.llm.defaultProvider) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`LLM provider '${providerName}' not available. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return provider;
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  async testProvider(providerName) {
    try {
      const provider = this.getProvider(providerName);
      const response = await provider.invoke([
        { role: 'user', content: 'Hello, this is a test message.' }
      ]);
      logger.info(`Provider ${providerName} test successful`);
      return { success: true, response: response.content };
    } catch (error) {
      logger.error(`Provider ${providerName} test failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new LLMProviderService();
