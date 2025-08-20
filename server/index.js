import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configuration and services
import { config, validateConfig } from './config/index.js';
import logger from './config/logger.js';
import { rateLimiter, validateApiKey, requestLogger } from './middleware/auth.js';

// Import routes
import chatRouter from './routes/chat.js';
import adminRouter from './routes/admin.js';

// Import services to initialize them
import llmProvider from './services/llmProvider.js';
import vectorStore from './services/vectorStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Server {
  constructor() {
    this.app = express();
    this.app.set('trust proxy', 1);
    this.port = config.port;
  }

  async initialize() {
    try {
      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Initialize services
      await this.initializeServices();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  async initializeServices() {
    try {
      // LLM Provider is already initialized in its constructor
      logger.info('LLM Provider service ready');

      // Initialize vector store
      await vectorStore.initialize();
      logger.info('Vector store service initialized');

    } catch (error) {
      logger.error('Error initializing services:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration
    this.app.use(cors({
      origin: config.nodeEnv === 'production' 
        ? ['http://localhost:3000'] // Add your production domains here
        : true,
      credentials: true
    }));

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use('/api/', rateLimiter);

    // API key validation (optional)
    this.app.use('/api/', validateApiKey);

    // Serve static files from client build (in production)
    if (config.nodeEnv === 'production') {
      this.app.use(express.static(path.join(__dirname, '../client/build')));
    }
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/chat', chatRouter);
    this.app.use('/api/admin', adminRouter);

    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        availableProviders: llmProvider.getAvailableProviders()
      });
    });

    // Serve React app (production)
    if (config.nodeEnv === 'production') {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
      });
    }

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);

      res.status(500).json({
        success: false,
        error: config.nodeEnv === 'production' 
          ? 'Internal server error' 
          : error.message,
        ...(config.nodeEnv !== 'production' && { stack: error.stack })
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  async start() {
    try {
      await this.initialize();

      this.app.listen(this.port, () => {
        logger.info(`🚀 Server running on port ${this.port}`);
        logger.info(`📊 Environment: ${config.nodeEnv}`);
        logger.info(`🤖 Available LLM providers: ${llmProvider.getAvailableProviders().join(', ')}`);
        logger.info(`🔍 Vector store: ${config.vectorDb.collectionName}`);
        
        if (config.nodeEnv === 'development') {
          logger.info(`💻 API endpoints available at http://localhost:${this.port}/api`);
        }
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new Server();
server.start().catch((error) => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});
