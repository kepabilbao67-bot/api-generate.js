/**
 * Usage & Quota Routes
 * GET /api/v1/usage          - My current usage
 * GET /api/v1/usage/:slug    - Usage per API
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUserPlanDetails } from '../billing/plans.js';
import db from '../utils/database.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const plan = getUserPlanDetails(req.user.userId);
  const apis = db.prepare('SELECT COUNT(*) as c FROM apis WHERE owner_id = ?').get(req.user.userId);
  const requests = db.prepare(`
    SELECT COUNT(*) as total FROM request_logs
    WHERE api_id IN (SELECT id FROM apis WHERE owner_id = ?)
    AND created_at > datetime('now', '-30 days')
  `).get(req.user.userId);

  res.json({
    success: true,
    plan: plan.planId,
    usage: {
      apis: { used: apis.c, limit: plan.apisLimit === -1 ? 'unlimited' : plan.apisLimit },
      requestsThisMonth: { used: requests.total, limit: plan.requestsPerMonth === -1 ? 'unlimited' : plan.requestsPerMonth },
    },
    percentUsed: {
      apis: plan.apisLimit === -1 ? 0 : Math.round((apis.c / plan.apisLimit) * 100),
      requests: plan.requestsPerMonth === -1 ? 0 : Math.round((requests.total / plan.requestsPerMonth) * 100),
    },
  });
});

router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const daily = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as requests
    FROM request_logs WHERE api_id = ? AND created_at > datetime('now','-30 days')
    GROUP BY date(created_at) ORDER BY date ASC
  `).all(api.id);

  const byMethod = db.prepare(`
    SELECT method, COUNT(*) as count FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now','-30 days')
    GROUP BY method
  `).all(api.id);

  const byEndpoint = db.prepare(`
    SELECT endpoint, COUNT(*) as count, AVG(latency_ms) as avg_latency
    FROM request_logs WHERE api_id = ? AND created_at > datetime('now','-30 days')
    GROUP BY endpoint ORDER BY count DESC LIMIT 10
  `).all(api.id);

  res.json({
    success: true,
    api: api.name,
    period: 'last 30 days',
    totalRequests: api.total_requests,
    daily,
    byMethod,
    byEndpoint,
  });
});

export default router;
