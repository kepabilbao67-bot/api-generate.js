/**
 * Monitoring & Alerts Routes
 * POST /api/v1/monitoring/alerts       - Create alert rule
 * GET  /api/v1/monitoring/alerts       - List alerts
 * GET  /api/v1/monitoring/health/:slug - Detailed health check
 * DELETE /api/v1/monitoring/alerts/:id - Delete alert
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    threshold REAL NOT NULL,
    comparison TEXT DEFAULT 'gt',
    webhook_url TEXT,
    email_notify INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    last_triggered TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create alert rule
router.post('/alerts', requireAuth, (req, res) => {
  const { apiId, type, threshold, comparison, webhookUrl } = req.body;
  if (!apiId || !type || threshold === undefined) {
    return res.status(400).json({
      error: 'apiId, type, and threshold required',
      types: ['latency_high', 'error_rate', 'requests_spike', 'downtime', 'revenue_drop'],
    });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO alert_rules (id, api_id, user_id, type, threshold, comparison, webhook_url)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, apiId, req.user.userId, type, threshold, comparison || 'gt', webhookUrl || null);
  res.status(201).json({ success: true, alert: { id, type, threshold } });
});

// List alerts
router.get('/alerts', requireAuth, (req, res) => {
  const alerts = db.prepare(`
    SELECT ar.*, a.name as api_name, a.slug as api_slug
    FROM alert_rules ar
    JOIN apis a ON ar.api_id = a.id
    WHERE ar.user_id = ?
    ORDER BY ar.created_at DESC
  `).all(req.user.userId);
  res.json({ success: true, alerts });
});

// Detailed health for an API
router.get('/health/:slug', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const last1h = db.prepare(`
    SELECT COUNT(*) as requests, AVG(latency_ms) as avg_latency,
           MAX(latency_ms) as max_latency, MIN(latency_ms) as min_latency,
           SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as server_errors,
           SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as client_errors
    FROM request_logs WHERE api_id = ? AND created_at > datetime('now','-1 hour')
  `).get(api.id);

  const last24h = db.prepare(`
    SELECT COUNT(*) as requests FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now','-24 hours')
  `).get(api.id);

  const errorRate = last1h.requests > 0 ? ((last1h.server_errors / last1h.requests) * 100) : 0;
  const health = errorRate < 1 ? 'healthy' : errorRate < 5 ? 'degraded' : 'unhealthy';

  res.json({
    success: true,
    api: api.name,
    slug: api.slug,
    health,
    metrics: {
      lastHour: { ...last1h, errorRate: `${errorRate.toFixed(2)}%` },
      last24h: { requests: last24h.requests },
      allTime: { requests: api.total_requests, avgLatency: `${api.avg_latency}ms` },
    },
  });
});

// Delete alert
router.delete('/alerts/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM alert_rules WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true });
});

export default router;
