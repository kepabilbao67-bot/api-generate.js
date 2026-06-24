/**
 * Analytics Routes
 * GET /api/v1/analytics/overview        - Owner overview
 * GET /api/v1/analytics/:slug           - API analytics
 * GET /api/v1/analytics/:slug/realtime  - Real-time stats
 * GET /api/v1/analytics/:slug/errors    - Error analytics
 * GET /api/v1/analytics/:slug/consumers - Consumer usage
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOwnerOverview, getApiAnalytics, getRealTimeStats, getConsumerUsage, getErrorAnalytics } from '../analytics/dashboard.js';
import db from '../utils/database.js';

const router = Router();

// Owner overview dashboard
router.get('/overview', requireAuth, (req, res) => {
  const overview = getOwnerOverview(req.user.userId);
  res.json({ success: true, ...overview });
});

// API detailed analytics
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);

  if (!api) return res.status(404).json({ error: 'API not found or not owned by you' });

  const period = req.query.period || '7d';
  const analytics = getApiAnalytics(api.id, period);
  res.json({ success: true, ...analytics });
});

// Real-time stats
router.get('/:slug/realtime', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);

  if (!api) return res.status(404).json({ error: 'API not found' });

  const stats = getRealTimeStats(api.id);
  res.json({ success: true, ...stats });
});

// Error analytics
router.get('/:slug/errors', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);

  if (!api) return res.status(404).json({ error: 'API not found' });

  const period = req.query.period || '7d';
  const errors = getErrorAnalytics(api.id, period);
  res.json({ success: true, ...errors });
});

// Consumer usage breakdown
router.get('/:slug/consumers', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);

  if (!api) return res.status(404).json({ error: 'API not found' });

  const period = req.query.period || '30d';
  const consumers = getConsumerUsage(api.id, period);
  res.json({ success: true, consumers });
});

export default router;
