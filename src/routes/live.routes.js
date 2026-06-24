/**
 * Live API Routes - Proxy to generated APIs
 * ALL /api/v1/live/:apiSlug/*  - Route to generated API endpoints
 */

import { Router } from 'express';
import { requireApiKey, apiRateLimit } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import { logRequest } from '../analytics/tracker.js';

const router = Router();

// All requests to live APIs go through here
router.all('/:apiSlug/*', requireApiKey, apiRateLimit, (req, res) => {
  const startTime = Date.now();
  const { apiSlug } = req.params;
  const path = '/' + req.params[0]; // everything after the slug
  const method = req.method;

  try {
    const result = apiEngine.executeRequest(apiSlug, method, path, req.body, req.query);

    const statusCode = result.status || 200;
    const latencyMs = Date.now() - startTime;

    // Log for analytics
    setImmediate(() => {
      logRequest({
        apiId: req.apiKeyInfo.apiId,
        apiKeyId: req.apiKeyInfo.keyId,
        method,
        endpoint: path,
        statusCode,
        latencyMs,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestBody: req.body,
        responseSize: JSON.stringify(result).length,
      });
    });

    // Set performance headers
    res.setHeader('X-Response-Time', `${latencyMs}ms`);
    res.setHeader('X-Powered-By', 'APIForge');

    res.status(statusCode).json(result);
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    // Log error
    setImmediate(() => {
      logRequest({
        apiId: req.apiKeyInfo?.apiId,
        apiKeyId: req.apiKeyInfo?.keyId,
        method,
        endpoint: path,
        statusCode: 400,
        latencyMs,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestBody: req.body,
        responseSize: 0,
      });
    });

    res.status(400).json({ error: err.message });
  }
});

// Handle base slug requests (no sub-path)
router.all('/:apiSlug', requireApiKey, apiRateLimit, (req, res) => {
  const startTime = Date.now();
  const { apiSlug } = req.params;

  try {
    const result = apiEngine.executeRequest(apiSlug, req.method, '/', req.body, req.query);
    const latencyMs = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${latencyMs}ms`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
