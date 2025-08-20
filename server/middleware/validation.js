import { body, validationResult } from 'express-validator';
import logger from '../config/logger.js';

// Validation rules for chat messages
export const validateChatMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  
  body('provider')
    .optional()
    .isIn(['openai', 'anthropic', 'bedrock'])
    .withMessage('Provider must be one of: openai, anthropic, bedrock'),
  
  body('maxContextDocs')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('maxContextDocs must be an integer between 1 and 10'),
  
  body('includeContext')
    .optional()
    .isBoolean()
    .withMessage('includeContext must be a boolean')
];

// Validation rules for document ingestion
export const validateDocumentIngestion = [
  body('url')
    .optional()
    .isURL()
    .withMessage('URL must be a valid URL'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long'),
  
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  
  body('source')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Source must be between 1 and 100 characters'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn('Validation errors:', errorMessages);
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errorMessages
    });
  }
  
  next();
};

// Custom validation for file uploads (if needed later)
export const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }
  
  const file = req.file || (req.files && req.files[0]);
  
  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'File too large',
      details: 'File size must be less than 5MB'
    });
  }
  
  // Check file type
  const allowedTypes = ['text/plain', 'application/pdf', 'text/html', 'text/markdown'];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid file type',
      details: 'Only text, PDF, HTML, and Markdown files are allowed'
    });
  }
  
  next();
};
