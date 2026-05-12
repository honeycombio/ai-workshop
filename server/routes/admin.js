import express from 'express';
import { validateDocumentIngestion, handleValidationErrors } from '../middleware/validation.js';
import vectorStore from '../services/vectorStore.js';
import { Document } from '@langchain/core/documents';
import logger from '../config/logger.js';
import DataIngestionService from '../../scripts/ingest-data.js';
import HoneycombPulumiIngestionService from '../../scripts/ingest-honeycomb-pulumi.js';

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

// POST /api/admin/ingest-all - Ingest all documentation (OpenTelemetry + Honeycomb Pulumi)
router.post('/ingest-all', async (req, res) => {
  try {
    logger.info('Starting full documentation ingestion...');

    // Initialize vector store
    await vectorStore.initialize();

    // Delete existing collection if requested
    const { reset = true } = req.body;
    if (reset) {
      logger.info('Resetting vector store...');
      await vectorStore.deleteCollection().catch(() => {});
      await vectorStore.initialize();
    }

    const results = {
      otelDocs: null,
      honeycombPulumiDocs: null,
      totalDocuments: 0,
      totalChunks: 0,
    };

    // 1. Ingest OpenTelemetry documentation
    try {
      logger.info('Ingesting OpenTelemetry documentation...');
      const otelService = new DataIngestionService();
      results.otelDocs = await otelService.ingestSampleDocuments();
      logger.info(`OpenTelemetry docs ingested: ${results.otelDocs.documentsIngested} documents, ${results.otelDocs.chunksCreated} chunks`);
    } catch (error) {
      logger.error('Error ingesting OpenTelemetry docs:', error);
      results.otelDocs = { error: error.message };
    }

    // 2. Ingest Honeycomb Pulumi provider documentation
    try {
      logger.info('Ingesting Honeycomb Pulumi provider documentation...');
      const honeycombService = new HoneycombPulumiIngestionService();
      results.honeycombPulumiDocs = await honeycombService.ingestDocuments();
      logger.info(`Honeycomb Pulumi docs ingested: ${results.honeycombPulumiDocs.documentsIngested} documents, ${results.honeycombPulumiDocs.chunksCreated} chunks`);
    } catch (error) {
      logger.error('Error ingesting Honeycomb Pulumi docs:', error);
      results.honeycombPulumiDocs = { error: error.message };
    }

    // Calculate totals
    if (results.otelDocs && !results.otelDocs.error) {
      results.totalDocuments += results.otelDocs.documentsIngested;
      results.totalChunks += results.otelDocs.chunksCreated;
    }
    if (results.honeycombPulumiDocs && !results.honeycombPulumiDocs.error) {
      results.totalDocuments += results.honeycombPulumiDocs.documentsIngested;
      results.totalChunks += results.honeycombPulumiDocs.chunksCreated;
    }

    logger.info(`✅ Full ingestion completed: ${results.totalDocuments} total documents, ${results.totalChunks} total chunks`);

    res.json({
      success: true,
      data: {
        message: 'Documentation ingestion completed',
        ...results
      }
    });

  } catch (error) {
    logger.error('Error during full ingestion:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to ingest documentation',
      message: error.message
    });
  }
});

export default router;