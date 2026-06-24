/**
 * Usage Insights & Recommendations
 * GET /api/v1/insights          - Personalized recommendations
 * GET /api/v1/insights/:slug    - API-specific insights
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';

const router = Router();

// Personal insights
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.userId;

  const apis = db.prepare('SELECT * FROM apis WHERE owner_id = ?').all(userId);
  const insights = [];

  // Check if user has any APIs
  if (apis.length === 0) {
    insights.push({
      type: 'action',
      priority: 'high',
      title: 'Create your first API',
      message: 'You haven\'t created any APIs yet. Try /api/v1/quick/tasks for an instant start!',
      action: 'POST /api/v1/quick/tasks',
    });
  }

  // Check for APIs with no traffic
  const noTraffic = apis.filter(a => a.total_requests === 0);
  if (noTraffic.length > 0) {
    insights.push({
      type: 'optimization',
      priority: 'medium',
      title: `${noTraffic.length} API(s) with zero traffic`,
      message: 'Consider promoting these APIs or making them public on the marketplace.',
      apis: noTraffic.map(a => a.slug),
    });
  }

  // Check for free APIs that could monetize
  const freeWithTraffic = apis.filter(a => a.pricing_model === 'free' && a.total_requests > 100);
  if (freeWithTraffic.length > 0) {
    const potentialRevenue = freeWithTraffic.reduce((sum, a) => sum + (a.total_requests * 0.001), 0);
    insights.push({
      type: 'monetization',
      priority: 'high',
      title: 'Monetization opportunity',
      message: `${freeWithTraffic.length} free API(s) have traffic. At $0.001/request, you could earn ~$${potentialRevenue.toFixed(2)}/month.`,
      apis: freeWithTraffic.map(a => ({ slug: a.slug, requests: a.total_requests })),
      action: 'PUT /api/v1/apis/:slug with { "pricing_model": "paid", "price_per_request": 0.001 }',
    });
  }

  // Check for high-latency APIs
  const highLatency = apis.filter(a => a.avg_latency > 500);
  if (highLatency.length > 0) {
    insights.push({
      type: 'performance',
      priority: 'medium',
      title: 'Performance issue detected',
      message: `${highLatency.length} API(s) have avg latency > 500ms. Consider adding the "cache" plugin.`,
      apis: highLatency.map(a => ({ slug: a.slug, latency: `${a.avg_latency}ms` })),
      action: 'POST /api/v1/plugins/:slug with { "type": "cache", "config": { "ttl": 60 } }',
    });
  }

  // Check plan limits
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
  const planLimits = { free: 3, starter: 10, pro: 50, enterprise: -1 };
  const limit = planLimits[user?.plan || 'free'];
  if (limit > 0 && apis.length >= limit * 0.8) {
    insights.push({
      type: 'upgrade',
      priority: 'medium',
      title: 'Approaching plan limit',
      message: `You're using ${apis.length}/${limit} APIs. Consider upgrading for more capacity.`,
      action: 'POST /api/v1/billing/subscribe',
    });
  }

  // General tips
  if (apis.some(a => a.visibility === 'private') && !apis.some(a => a.visibility === 'public')) {
    insights.push({
      type: 'tip',
      priority: 'low',
      title: 'Publish to marketplace',
      message: 'Make your APIs public to earn from other developers using them.',
    });
  }

  res.json({
    success: true,
    insights,
    summary: {
      totalApis: apis.length,
      totalRequests: apis.reduce((s, a) => s + a.total_requests, 0),
      totalRevenue: apis.reduce((s, a) => s + a.total_revenue, 0),
      avgLatency: Math.round(apis.reduce((s, a) => s + (a.avg_latency || 0), 0) / (apis.length || 1)),
    },
  });
});

// API-specific insights
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const insights = [];
  const schema = JSON.parse(api.schema_definition);

  // Resources with few fields
  schema.resources?.forEach(r => {
    if (r.fields.length < 3) {
      insights.push({ type: 'schema', message: `"${r.name}" has only ${r.fields.length} fields. Add more for a richer API.` });
    }
    if (!r.fields.some(f => f.required)) {
      insights.push({ type: 'validation', message: `"${r.name}" has no required fields. Add validation to prevent bad data.` });
    }
  });

  // Traffic suggestions
  if (api.total_requests > 1000 && api.pricing_model === 'free') {
    insights.push({ type: 'monetize', message: `${api.total_requests} requests served for free. Consider charging $0.001/request.` });
  }

  if (api.total_requests === 0) {
    insights.push({ type: 'promote', message: 'No traffic yet. Share the OpenAPI spec or make it public.' });
  }

  // Performance
  if (api.avg_latency > 200) {
    insights.push({ type: 'performance', message: `Avg latency is ${api.avg_latency}ms. Add caching plugin for improvement.` });
  }

  res.json({ success: true, api: api.name, insights });
});

export default router;
