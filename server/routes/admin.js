import express from 'express';
import { validateDocumentIngestion, handleValidationErrors } from '../middleware/validation.js';
import vectorStore from '../services/vectorStore.js';
import { Document } from '@langchain/core/documents';
import logger from '../config/logger.js';

const router = express.Router();

// POST /api/admin/ingest - Add documents to the vector store
router.post('/ingest', validateDocumentIngestion, handleValidationErrors, async (req, res) => {
  try {
    const { url, content, title, source, metadata = {} } = req.body;

    if (!content && !url) {
      return res.status(400).json({
        success: false,
        error: 'Either content or url must be provided'
      });
    }

    let documentContent = content;
    
    // If URL is provided, fetch content (simplified for now)
    if (url && !content) {
      // Note: In production, you'd want to implement proper web scraping
      // For now, we'll return an error suggesting manual content provision
      return res.status(400).json({
        success: false,
        error: 'URL ingestion not implemented. Please provide content directly.'
      });
    }

    // Create document
    const document = new Document({
      pageContent: documentContent,
      metadata: {
        title,
        source,
        url: url || null,
        ingestedAt: new Date().toISOString(),
        ...metadata
      }
    });

    // Add to vector store
    const chunksAdded = await vectorStore.addDocuments([document]);

    logger.info(`Document ingested: ${title} (${chunksAdded} chunks)`);

    res.json({
      success: true,
      data: {
        title,
        source,
        chunksAdded,
        message: 'Document successfully ingested'
      }
    });

  } catch (error) {
    logger.error('Error ingesting document:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to ingest document',
      message: error.message
    });
  }
});

// GET /api/admin/vector-store/info - Get vector store information
router.get('/vector-store/info', async (req, res) => {
  try {
    const info = await vectorStore.getCollectionInfo();

    res.json({
      success: true,
      data: info
    });

  } catch (error) {
    logger.error('Error getting vector store info:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get vector store information',
      message: error.message
    });
  }
});

// DELETE /api/admin/vector-store - Delete vector store collection
router.delete('/vector-store', async (req, res) => {
  try {
    await vectorStore.deleteCollection();

    logger.info('Vector store collection deleted');

    res.json({
      success: true,
      data: {
        message: 'Vector store collection deleted successfully'
      }
    });

  } catch (error) {
    logger.error('Error deleting vector store:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete vector store',
      message: error.message
    });
  }
});

// POST /api/admin/search - Search documents in vector store
router.post('/search', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const results = await vectorStore.similaritySearchWithScore(query, parseInt(maxResults));

    res.json({
      success: true,
      data: {
        query,
        results: results.map(([doc, score]) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
          score
        }))
      }
    });

  } catch (error) {
    logger.error('Error searching vector store:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search vector store',
      message: error.message
    });
  }
});

export default router;