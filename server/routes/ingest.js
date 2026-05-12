import express from 'express';
import ingestionService from '../services/ingestionService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * POST /api/ingest
 * Trigger data ingestion of OpenTelemetry documentation
 *
 * Query parameters:
 *   - reset: If 'true', delete existing data before ingesting (optional, default: false)
 *
 * Request body (optional):
 *   - document: Custom document to ingest with structure:
 *     {
 *       title: string,
 *       content: string,
 *       source: string,
 *       metadata: object (optional)
 *     }
 */
router.post('/', async (req, res) => {
  try {
    const { reset } = req.query;
    const { document } = req.body;

    logger.info('Ingestion endpoint called', {
      reset: reset === 'true',
      customDocument: !!document,
      ip: req.ip
    });

    let result;

    if (document) {
      // Ingest custom document
      if (!document.title || !document.content || !document.source) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document structure. Required fields: title, content, source'
        });
      }

      result = await ingestionService.ingestCustomDocument(document);
    } else if (reset === 'true') {
      // Reset and ingest sample documents
      result = await ingestionService.resetAndIngest();
    } else {
      // Ingest sample documents without reset
      result = await ingestionService.ingestSampleDocuments();
    }

    logger.info('Ingestion completed successfully', result);

    res.json({
      success: true,
      message: 'Data ingestion completed successfully',
      ...result
    });

  } catch (error) {
    logger.error('Ingestion endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Data ingestion failed',
      message: error.message
    });
  }
});

/**
 * GET /api/ingest/status
 * Get ingestion status and vector store information
 */
router.get('/status', async (req, res) => {
  try {
    // Import vector store to get stats
    const vectorStore = (await import('../services/vectorStore.js')).default;

    // Get collection info if available
    let info = {};
    try {
      if (vectorStore.client) {
        // For OpenSearch
        const indexStats = await vectorStore.client.indices.stats({
          index: vectorStore.indexName
        });

        info = {
          indexName: vectorStore.indexName,
          documentCount: indexStats.body._all?.primaries?.docs?.count || 0,
          storeSizeBytes: indexStats.body._all?.primaries?.store?.size_in_bytes || 0
        };
      }
    } catch (error) {
      logger.warn('Could not retrieve vector store stats:', error.message);
      info = {
        status: 'Vector store initialized but stats unavailable'
      };
    }

    res.json({
      success: true,
      vectorStore: info,
      ready: true
    });

  } catch (error) {
    logger.error('Status endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      message: error.message
    });
  }
});

export default router;
