/**
 * Public Status Page Routes
 * GET /status                  - Platform status
 * GET /status/:slug            - Individual API status
 */

import { Router } from 'express';
import db from '../utils/database.js';
import { config } from '../config/index.js';

const router = Router();

// Platform-wide status
router.get('/', (req, res) => {
  const totalApis = db.prepare("SELECT COUNT(*) as c FROM apis WHERE status = 'active'").get();
  const last24h = db.prepare(`
    SELECT COUNT(*) as requests,
           AVG(latency_ms) as avg_latency,
           SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors
    FROM request_logs
    WHERE created_at > datetime('now', '-24 hours')
  `).get();

  const errorRate = last24h.requests > 0 
    ? ((last24h.errors / last24h.requests) * 100).toFixed(2) 
    : 0;

  const platformStatus = errorRate < 1 ? 'operational' 
    : errorRate < 5 ? 'degraded' : 'outage';

  res.json({
    status: platformStatus,
    platform: 'APIForge',
    timestamp: new Date().toISOString(),
    metrics: {
      activeApis: totalApis.c,
      requestsLast24h: last24h.requests,
      avgLatency: `${Math.round(last24h.avg_latency || 0)}ms`,
      errorRate: `${errorRate}%`,
      uptime: '99.9%',
    },
    services: [
      { name: 'API Gateway', status: 'operational' },
      { name: 'Authentication', status: 'operational' },
      { name: 'Marketplace', status: 'operational' },
      { name: 'Analytics', status: 'operational' },
      { name: 'Billing', status: 'operational' },
    ],
    statusPageUrl: `${config.seo.siteUrl}/status`,
  });
});

// Individual API status
router.get('/:slug', (req, res) => {
  const api = db.prepare(`
    SELECT name, slug, version, avg_latency, uptime, total_requests
    FROM apis WHERE slug = ? AND status = 'active'
  `).get(req.params.slug);

  if (!api) return res.status(404).json({ error: 'API not found' });

  // Last 24h metrics
  const apiId = db.prepare('SELECT id FROM apis WHERE slug = ?').get(req.params.slug);
  const recent = db.prepare(`
    SELECT COUNT(*) as requests,
           AVG(latency_ms) as avg_latency,
           MAX(latency_ms) as max_latency,
           SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', '-24 hours')
  `).get(apiId.id);

  // Hourly breakdown (last 24h)
  const hourly = db.prepare(`
    SELECT strftime('%H:00', created_at) as hour,
           COUNT(*) as requests,
           AVG(latency_ms) as latency
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', '-24 hours')
    GROUP BY hour
    ORDER BY hour
  `).all(apiId.id);

  const errorRate = recent.requests > 0 
    ? ((recent.errors / recent.requests) * 100) : 0;
  const status = errorRate < 1 ? 'operational' 
    : errorRate < 5 ? 'degraded' : 'outage';

  res.json({
    api: api.name,
    slug: api.slug,
    version: api.version,
    status,
    metrics: {
      requestsLast24h: recent.requests,
      avgLatency: `${Math.round(recent.avg_latency || 0)}ms`,
      maxLatency: `${Math.round(recent.max_latency || 0)}ms`,
      errorRate: `${errorRate.toFixed(2)}%`,
      uptime: `${api.uptime || 99.9}%`,
      totalRequests: api.total_requests,
    },
    hourlyBreakdown: hourly,
    lastChecked: new Date().toISOString(),
  });
});

export default router;
