/**
 * API Comparison Routes
 * GET /api/v1/compare?apis=slug1,slug2,slug3
 * 
 * Side-by-side comparison of multiple APIs
 */

import { Router } from 'express';
import db from '../utils/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { apis } = req.query;

  if (!apis) {
    return res.status(400).json({
      error: 'Provide comma-separated API slugs',
      example: '/api/v1/compare?apis=pet-store,tasks,contacts',
    });
  }

  const slugs = apis.split(',').slice(0, 5); // Max 5

  const results = slugs.map(slug => {
    const api = db.prepare(`
      SELECT a.*, u.username as creator
      FROM apis a JOIN users u ON a.owner_id = u.id
      WHERE a.slug = ?
    `).get(slug.trim());

    if (!api) return { slug: slug.trim(), found: false };

    return {
      slug: api.slug,
      found: true,
      name: api.name,
      category: api.category,
      creator: api.creator,
      version: api.version,
      pricing: {
        model: api.pricing_model,
        perRequest: api.price_per_request,
        monthly: api.monthly_price,
      },
      performance: {
        avgLatency: `${api.avg_latency || 0}ms`,
        uptime: `${api.uptime || 99.9}%`,
        totalRequests: api.total_requests,
      },
      features: {
        endpoints: api.endpoints_count,
        rateLimit: api.rate_limit,
      },
      createdAt: api.created_at,
    };
  });

  // Generate comparison summary
  const found = results.filter(r => r.found);
  const winner = {
    fastest: found.length > 0 ? found.reduce((a, b) =>
      parseInt(a.performance?.avgLatency) < parseInt(b.performance?.avgLatency) ? a : b
    )?.slug : null,
    cheapest: found.length > 0 ? found.reduce((a, b) =>
      (a.pricing?.monthly || 0) < (b.pricing?.monthly || 0) ? a : b
    )?.slug : null,
    mostPopular: found.length > 0 ? found.reduce((a, b) =>
      (a.performance?.totalRequests || 0) > (b.performance?.totalRequests || 0) ? a : b
    )?.slug : null,
  };

  res.json({
    success: true,
    comparison: results,
    summary: {
      apisCompared: found.length,
      winner,
    },
  });
});

export default router;
