/**
 * Request Logs Viewer
 * GET /api/v1/logs/:slug          - View request logs for an API
 * GET /api/v1/logs/:slug/errors   - View only errors
 * GET /api/v1/logs/:slug/slow     - View slow requests
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';

const router = Router();

// View request logs
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { page = 1, limit = 50, method, status, from, to } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE api_id = ?';
  const params = [api.id];

  if (method) { where += ' AND method = ?'; params.push(method.toUpperCase()); }
  if (status) { where += ' AND status_code = ?'; params.push(parseInt(status)); }
  if (from) { where += ' AND created_at >= ?'; params.push(from); }
  if (to) { where += ' AND created_at <= ?'; params.push(to); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM request_logs ${where}`).get(...params);
  const logs = db.prepare(`
    SELECT method, endpoint, status_code, latency_ms, ip_address, user_agent, created_at
    FROM request_logs ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ success: true, logs, meta: { total: total.c, page: parseInt(page), limit: parseInt(limit) } });
});

// Error logs only
router.get('/:slug/errors', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const logs = db.prepare(`
    SELECT method, endpoint, status_code, latency_ms, ip_address, created_at
    FROM request_logs
    WHERE api_id = ? AND status_code >= 400
    ORDER BY created_at DESC LIMIT 100
  `).all(api.id);

  res.json({ success: true, errors: logs, count: logs.length });
});

// Slow requests (> 500ms)
router.get('/:slug/slow', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const threshold = parseInt(req.query.threshold) || 500;
  const logs = db.prepare(`
    SELECT method, endpoint, status_code, latency_ms, created_at
    FROM request_logs
    WHERE api_id = ? AND latency_ms > ?
    ORDER BY latency_ms DESC LIMIT 50
  `).all(api.id, threshold);

  res.json({ success: true, slowRequests: logs, threshold: `${threshold}ms`, count: logs.length });
});

export default router;
