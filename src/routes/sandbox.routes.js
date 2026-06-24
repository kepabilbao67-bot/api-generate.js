/**
 * API Sandbox / Mock Mode
 * Allows testing APIs without affecting real data
 * 
 * POST /api/v1/sandbox/:slug/enable   - Enable sandbox for an API
 * ALL  /api/v1/sandbox/:slug/*        - Use sandbox version
 * POST /api/v1/sandbox/:slug/reset    - Reset sandbox data
 * 
 * Use header: X-Sandbox: true on live API to auto-route to sandbox
 */

import { Router } from 'express';
import { requireApiKey, apiRateLimit } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import db from '../utils/database.js';

const router = Router();

// In-memory sandbox storage (separate from production)
const sandboxStorage = new Map();

// Enable sandbox for an API
router.post('/:slug/enable', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id, slug FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  if (!sandboxStorage.has(api.slug)) {
    sandboxStorage.set(api.slug, new Map());
  }

  res.json({
    success: true,
    message: `Sandbox enabled for "${api.slug}"`,
    usage: {
      method1: `Add header "X-Sandbox: true" to your regular API calls`,
      method2: `Use /api/v1/sandbox/${api.slug}/... endpoints directly`,
    },
    note: 'Sandbox data is separate from production and resets on server restart',
  });
});

// Reset sandbox data
router.post('/:slug/reset', requireAuth, (req, res) => {
  sandboxStorage.set(req.params.slug, new Map());
  res.json({ success: true, message: 'Sandbox data reset' });
});

// Handle all sandbox requests
router.all('/:slug/*', requireApiKey, (req, res) => {
  const { slug } = req.params;
  const path = '/' + req.params[0];
  const method = req.method;

  try {
    // Use sandbox storage instead of production
    const sandboxKey = `sandbox_${slug}`;

    // Temporarily swap storage
    const originalGetStorage = apiEngine.getStorage.bind(apiEngine);
    const originalSetStorage = apiEngine.setStorage.bind(apiEngine);

    apiEngine.getStorage = (key) => {
      if (!sandboxStorage.has(slug)) sandboxStorage.set(slug, new Map());
      const store = sandboxStorage.get(slug);
      if (!store.has(key)) store.set(key, []);
      return store.get(key);
    };

    apiEngine.setStorage = (key, data) => {
      if (!sandboxStorage.has(slug)) sandboxStorage.set(slug, new Map());
      sandboxStorage.get(slug).set(key, data);
    };

    const result = apiEngine.executeRequest(slug, method, path, req.body, req.query);

    // Restore original storage methods
    apiEngine.getStorage = originalGetStorage;
    apiEngine.setStorage = originalSetStorage;

    res.setHeader('X-Sandbox', 'true');
    res.setHeader('X-Environment', 'sandbox');
    res.status(result.status || 200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message, environment: 'sandbox' });
  }
});

// Handle base slug (no sub-path)
router.all('/:slug', requireApiKey, (req, res) => {
  res.json({
    sandbox: true,
    api: req.params.slug,
    message: 'Sandbox active. Use sub-paths to interact with resources.',
    example: `/api/v1/sandbox/${req.params.slug}/items`,
  });
});

export default router;
