import express from 'express';
import { validateChatMessage, handleValidationErrors } from '../middleware/validation.js';
import ragService from '../services/ragService.js';
import llmProvider from '../services/llmProvider.js';
import logger from '../config/logger.js';
import { config } from '../config/index.js';

const router = express.Router();

// POST /api/chat - Main chat endpoint
router.post('/', validateChatMessage, handleValidationErrors, async (req, res) => {
  try {
    const { 
      message, 
      provider = null, 
      maxContextDocs = 5, 
      includeContext = false 
    } = req.body;

    logger.info(`Chat request received: "${message}" with provider: ${provider || 'default'}`);

    // Generate response using RAG service
    const result = await ragService.askQuestion(message, {
      provider,
      maxContextDocs,
      includeContext
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error in chat endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate response',
      message: error.message
    });
  }
});

// GET /api/chat/context - Get context for a question without generating response
router.get('/context', async (req, res) => {
  try {
    const { question, maxDocs = 5 } = req.query;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question parameter is required'
      });
    }

    const context = await ragService.getContextForQuestion(question, parseInt(maxDocs));

    res.json({
      success: true,
      data: context
    });

  } catch (error) {
    logger.error('Error getting context:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve context',
      message: error.message
    });
  }
});

// GET /api/chat/providers - Get available LLM providers
router.get('/providers', (req, res) => {
  try {
    const providers = llmProvider.getAvailableProviders();
    const default_provider = config.llm.defaultProvider
    
    res.json({
      success: true,
      data: {
        providers,
        default: default_provider || null
      }
    });

  } catch (error) {
    logger.error('Error getting providers:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get providers',
      message: error.message
    });
  }
});

// POST /api/chat/test-provider - Test a specific provider
router.post('/test-provider', async (req, res) => {
  try {
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider parameter is required'
      });
    }

    const result = await llmProvider.testProvider(provider);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error testing provider:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to test provider',
      message: error.message
    });
  }
});

export default router;
