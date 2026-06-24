/**
 * API Management Routes (Create, manage your APIs)
 * POST   /api/v1/apis          - Generate a new API
 * GET    /api/v1/apis          - List my APIs
 * GET    /api/v1/apis/:slug    - Get API details
 * PUT    /api/v1/apis/:slug    - Update API
 * DELETE /api/v1/apis/:slug    - Delete API
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import { canCreateApi } from '../billing/plans.js';
import db from '../utils/database.js';

const router = Router();

// Generate a new API
router.post('/', requireAuth, async (req, res) => {
  try {
    // Check plan limits
    const check = canCreateApi(req.user.userId);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Plan limit reached', ...check });
    }

    const schema = req.body;
    if (!schema || !schema.name || !schema.resources) {
      return res.status(400).json({
        error: 'Invalid schema. Required: name, resources[]',
        example: {
          name: 'My Products API',
          description: 'A complete products management API',
          category: 'ecommerce',
          resources: [{
            name: 'Product',
            fields: [
              { name: 'title', type: 'string', required: true },
              { name: 'price', type: 'number', required: true },
              { name: 'description', type: 'string' },
              { name: 'inStock', type: 'boolean', default: true },
            ],
          }],
        },
      });
    }

    const result = await apiEngine.generate(schema, req.user.userId);
    res.status(201).json({ success: true, api: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List my APIs
router.get('/', requireAuth, (req, res) => {
  const apis = db.prepare(`
    SELECT id, name, slug, description, category, version, status, 
           pricing_model, endpoints_count, total_requests, total_revenue,
           avg_latency, uptime, created_at, updated_at
    FROM apis WHERE owner_id = ?
    ORDER BY created_at DESC
  `).all(req.user.userId);

  res.json({ success: true, apis, count: apis.length });
});

// Get API details
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare(`
    SELECT * FROM apis WHERE slug = ? AND owner_id = ?
  `).get(req.params.slug, req.user.userId);

  if (!api) return res.status(404).json({ error: 'API not found' });

  res.json({
    success: true,
    api: {
      ...api,
      schema_definition: JSON.parse(api.schema_definition),
      documentation: api.documentation ? JSON.parse(api.documentation) : null,
      tags: api.tags ? JSON.parse(api.tags) : [],
    },
  });
});

// Update API settings
router.put('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);

  if (!api) return res.status(404).json({ error: 'API not found' });

  const allowed = ['description', 'category', 'status', 'visibility', 'pricing_model', 'price_per_request', 'monthly_price', 'rate_limit'];
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowed.includes(key)) updates[key] = req.body[key];
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE apis SET ${sets}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...updates, id: api.id });

  res.json({ success: true, message: 'API updated' });
});

// Delete API
router.delete('/:slug', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM apis WHERE slug = ? AND owner_id = ?')
    .run(req.params.slug, req.user.userId);

  if (result.changes === 0) return res.status(404).json({ error: 'API not found' });
  res.json({ success: true, message: 'API deleted' });
});

export default router;
