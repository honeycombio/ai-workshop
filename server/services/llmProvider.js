import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
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
      // Initialize OpenAI
      if (config.llm.openai.apiKey) {
        this.providers.set('openai', new ChatOpenAI({
          openAIApiKey: config.llm.openai.apiKey,
          modelName: config.llm.openai.model,
          temperature: config.llm.temperature,
          maxTokens: config.llm.maxTokens
        }));
        logger.info('OpenAI provider initialized');
      }

      // Initialize Anthropic
      if (config.llm.anthropic.apiKey) {
        this.providers.set('anthropic', new ChatAnthropic({
          anthropicApiKey: config.llm.anthropic.apiKey,
          modelName: config.llm.anthropic.model,
          temperature: config.llm.temperature,
          maxTokens: config.llm.maxTokens
        }));
        logger.info('Anthropic provider initialized');
      }

      // Initialize Bedrock
      if (config.llm.bedrock.accessKeyId && config.llm.bedrock.secretAccessKey) {
        this.providers.set('bedrock', new ChatBedrockConverse({
          model: config.llm.bedrock.model,
          temperature: config.llm.temperature,
          maxTokens: config.llm.maxTokens,
          region: config.llm.bedrock.region,
          credentials: {
            accessKeyId: config.llm.bedrock.accessKeyId,
            secretAccessKey: config.llm.bedrock.secretAccessKey
          }
        }));
        logger.info('Bedrock provider initialized');
      }

      if (this.providers.size === 0) {
        throw new Error('No LLM providers could be initialized. Check your configuration.');
      }

    } catch (error) {
      logger.error('Error initializing LLM providers:', error);
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
