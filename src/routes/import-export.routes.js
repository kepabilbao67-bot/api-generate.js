/**
 * Import/Export Routes
 * POST /api/v1/import/openapi        - Import from OpenAPI spec
 * GET  /api/v1/export/:slug/openapi  - Export as OpenAPI
 * GET  /api/v1/export/:slug/postman  - Export as Postman
 * GET  /api/v1/export/:slug/schema   - Export raw schema
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { importFromOpenAPI, exportToOpenAPI, exportToPostman } from '../import-export/openapi.js';
import apiEngine from '../core/engine.js';
import { canCreateApi } from '../billing/plans.js';
import { config } from '../config/index.js';
import db from '../utils/database.js';

const router = Router();

// Import from OpenAPI
router.post('/import/openapi', requireAuth, async (req, res) => {
  try {
    const check = canCreateApi(req.user.userId);
    if (!check.allowed) return res.status(403).json({ error: 'Plan limit reached', ...check });

    const openApiSpec = req.body;
    if (!openApiSpec || !openApiSpec.openapi) {
      return res.status(400).json({ error: 'Valid OpenAPI 3.0 spec required in request body' });
    }

    // Convert to APIForge schema
    const schema = importFromOpenAPI(openApiSpec);

    // Option to just preview or auto-deploy
    if (req.query.deploy === 'true') {
      const result = await apiEngine.generate(schema, req.user.userId);
      return res.status(201).json({ success: true, message: 'Imported and deployed!', api: result, importMeta: schema._import });
    }

    res.json({ success: true, message: 'Schema imported. POST to /api/v1/apis to deploy.', schema });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export as OpenAPI
router.get('/export/:slug/openapi', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ? AND status = 'active'").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const spec = exportToOpenAPI(api);
  res.setHeader('Content-Type', 'application/json');
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${api.slug}-openapi.json"`);
  }
  res.json(spec);
});

// Export as Postman
router.get('/export/:slug/postman', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ? AND status = 'active'").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const baseUrl = `${config.baseUrl}/api/v1/live/${api.slug}`;
  const collection = exportToPostman(api, baseUrl);
  res.setHeader('Content-Type', 'application/json');
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${api.slug}-postman.json"`);
  }
  res.json(collection);
});

// Export raw schema
router.get('/export/:slug/schema', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ? AND status = 'active'").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });
  res.json({ success: true, schema: JSON.parse(api.schema_definition) });
});

export default router;
