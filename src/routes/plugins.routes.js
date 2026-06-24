/**
 * Plugin Routes
 * GET    /api/v1/plugins/available       - List available plugins
 * POST   /api/v1/plugins/:slug           - Add plugin to API
 * GET    /api/v1/plugins/:slug           - List API plugins
 * DELETE /api/v1/plugins/:slug/:pluginId - Remove plugin
 * PUT    /api/v1/plugins/:slug/:pluginId/toggle - Enable/disable
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PLUGIN_TYPES, addPlugin, getApiPlugins, removePlugin, togglePlugin } from '../plugins/system.js';
import db from '../utils/database.js';

const router = Router();

// List available plugin types
router.get('/available', (req, res) => {
  const plugins = Object.entries(PLUGIN_TYPES).map(([id, def]) => ({
    id,
    name: def.name,
    description: def.description,
    configSchema: def.configSchema,
  }));
  res.json({ success: true, plugins, count: plugins.length });
});

// Add plugin to an API
router.post('/:slug', requireAuth, (req, res) => {
  try {
    const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
      .get(req.params.slug, req.user.userId);
    if (!api) return res.status(404).json({ error: 'API not found' });

    const { type, config } = req.body;
    if (!type) return res.status(400).json({ error: 'Plugin type is required' });

    const plugin = addPlugin(api.id, type, config);
    res.status(201).json({ success: true, plugin });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List plugins for an API
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const plugins = getApiPlugins(api.id);
  res.json({ success: true, plugins, count: plugins.length });
});

// Remove plugin
router.delete('/:slug/:pluginId', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const removed = removePlugin(req.params.pluginId, api.id);
  if (!removed) return res.status(404).json({ error: 'Plugin not found' });
  res.json({ success: true, message: 'Plugin removed' });
});

// Toggle plugin
router.put('/:slug/:pluginId/toggle', requireAuth, (req, res) => {
  const { active } = req.body;
  togglePlugin(req.params.pluginId, active !== false);
  res.json({ success: true, message: `Plugin ${active !== false ? 'enabled' : 'disabled'}` });
});

export default router;
