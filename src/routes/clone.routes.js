/**
 * API Clone Routes - Fork/clone any public API
 * POST /api/v1/clone/:slug   - Clone a public API as your own
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import { canCreateApi } from '../billing/plans.js';
import { createApiKey } from '../auth/api-keys.js';
import { config } from '../config/index.js';
import db from '../utils/database.js';

const router = Router();

router.post('/:slug', requireAuth, async (req, res) => {
  try {
    const check = canCreateApi(req.user.userId);
    if (!check.allowed) return res.status(403).json({ error: 'Plan limit reached', ...check });

    const original = db.prepare("SELECT * FROM apis WHERE slug = ? AND visibility = 'public'").get(req.params.slug);
    if (!original) return res.status(404).json({ error: 'Public API not found' });

    const schema = JSON.parse(original.schema_definition);
    schema.name = req.body.name || `${schema.name} (Fork)`;
    schema.description = req.body.description || `Forked from ${original.name}`;
    schema.visibility = 'private';
    schema.pricing = req.body.pricing || { model: 'free' };

    const result = await apiEngine.generate(schema, req.user.userId);

    const apiRecord = db.prepare('SELECT id FROM apis WHERE slug = ?').get(result.slug);
    const apiKey = createApiKey(req.user.userId, apiRecord.id, {
      name: `clone-${result.slug}`,
      permissions: 'read,write,delete',
      rateLimit: 999999,
    });

    res.status(201).json({
      success: true,
      message: `Cloned "${original.name}" successfully!`,
      original: { name: original.name, slug: original.slug },
      clone: {
        name: schema.name,
        slug: result.slug,
        baseUrl: `${config.baseUrl}/api/v1/live/${result.slug}`,
        apiKey: apiKey.key,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
