/**
 * Data Export Routes - Export your API data
 * GET /api/v1/data/:slug/export?format=json  - Export all data as JSON
 * GET /api/v1/data/:slug/export?format=csv   - Export as CSV
 * POST /api/v1/data/:slug/import             - Bulk import data
 */

import { Router } from 'express';
import { requireApiKey } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import db from '../utils/database.js';

const router = Router();

// Export all data
router.get('/:slug/export', requireApiKey, (req, res) => {
  try {
    const { slug } = req.params;
    const format = req.query.format || 'json';
    const api = db.prepare("SELECT * FROM apis WHERE slug = ?").get(slug);
    if (!api) return res.status(404).json({ error: 'API not found' });

    const schema = JSON.parse(api.schema_definition);
    const allData = {};

    schema.resources.forEach(resource => {
      const name = resource.name.toLowerCase();
      const plural = name.endsWith('s') ? name : `${name}s`;
      const result = apiEngine.executeRequest(slug, 'GET', `/${plural}`, null, { limit: 10000 });
      allData[plural] = result.data || [];
    });

    if (format === 'csv') {
      const firstResource = Object.keys(allData)[0];
      const items = allData[firstResource] || [];
      if (items.length === 0) return res.send('');
      const headers = Object.keys(items[0]).join(',');
      const rows = items.map(item => Object.values(item).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-export.csv"`);
      return res.send([headers, ...rows].join('\n'));
    }

    res.setHeader('Content-Disposition', `attachment; filename="${slug}-export.json"`);
    res.json({ exportedAt: new Date().toISOString(), api: slug, data: allData });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk import data
router.post('/:slug/import', requireApiKey, (req, res) => {
  try {
    const { slug } = req.params;
    const { resource, items } = req.body;

    if (!resource || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'resource (string) and items (array) required' });
    }

    const results = { created: 0, errors: [] };

    for (const item of items) {
      try {
        apiEngine.executeRequest(slug, 'POST', `/${resource}`, item, {});
        results.created++;
      } catch (err) {
        results.errors.push({ item, error: err.message });
      }
    }

    res.json({ success: true, ...results, total: items.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
