import winston from 'winston';
import { config } from './index.js';

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'otel-ai-chatbot' },
  transports: []
});

// Always log to console for Docker/ECS environments (CloudWatch captures stdout/stderr)
logger.add(new winston.transports.Console({
  format: config.nodeEnv === 'production'
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
}));

// In development, also log to files
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}

export default logger;
