import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import logger from '../config/logger.js';

// Rate limiting middleware
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    });
  }
});

// Simple API key validation (optional)
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // If no API key is configured, skip validation
  if (!process.env.API_KEY) {
    return next();
  }
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn(`Invalid or missing API key from IP: ${req.ip}`);
    return res.status(401).json({
      error: 'Invalid or missing API key'
    });
  }
  
  next();
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};
