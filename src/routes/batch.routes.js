/**
 * Batch Operations Routes
 * Execute multiple API operations in a single request
 * POST /api/v1/batch/:slug
 * 
 * { "operations": [
 *   { "method": "POST", "path": "/tasks", "body": {...} },
 *   { "method": "POST", "path": "/tasks", "body": {...} },
 *   { "method": "GET", "path": "/tasks" }
 * ]}
 */

import { Router } from 'express';
import { requireApiKey, apiRateLimit } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';

const router = Router();

router.post('/:slug', requireApiKey, apiRateLimit, (req, res) => {
  const { slug } = req.params;
  const { operations } = req.body;

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({
      error: 'operations array is required',
      example: {
        operations: [
          { method: 'POST', path: '/tasks', body: { title: 'Task 1' } },
          { method: 'POST', path: '/tasks', body: { title: 'Task 2' } },
          { method: 'GET', path: '/tasks' },
        ],
      },
    });
  }

  if (operations.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 operations per batch' });
  }

  const results = [];
  const startTime = Date.now();

  for (const [index, op] of operations.entries()) {
    try {
      const result = apiEngine.executeRequest(
        slug,
        op.method || 'GET',
        op.path || '/',
        op.body || null,
        op.query || {}
      );
      results.push({ index, success: true, status: result.status || 200, data: result });
    } catch (err) {
      results.push({ index, success: false, status: 400, error: err.message });
    }
  }

  const totalTime = Date.now() - startTime;

  res.json({
    success: true,
    results,
    meta: {
      total: operations.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      executionTime: `${totalTime}ms`,
    },
  });
});

export default router;
