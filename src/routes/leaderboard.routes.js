/**
 * Leaderboard Routes
 * GET /api/v1/leaderboard/creators      - Top API creators
 * GET /api/v1/leaderboard/apis          - Most popular APIs
 * GET /api/v1/leaderboard/trending      - Trending this week
 * GET /api/v1/leaderboard/revenue       - Top earning APIs
 */

import { Router } from 'express';
import db from '../utils/database.js';

const router = Router();

// Top creators
router.get('/creators', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  const creators = db.prepare(`
    SELECT 
      u.username,
      u.display_name,
      COUNT(a.id) as api_count,
      COALESCE(SUM(a.total_requests), 0) as total_requests,
      COALESCE(SUM(a.total_revenue), 0) as total_revenue,
      AVG(a.uptime) as avg_rating,
      u.created_at as member_since
    FROM users u
    JOIN apis a ON u.id = a.owner_id
    WHERE a.status = 'active' AND a.visibility = 'public'
    GROUP BY u.id
    ORDER BY total_requests DESC
    LIMIT ?
  `).all(limit);

  res.json({
    success: true,
    leaderboard: creators.map((c, idx) => ({
      rank: idx + 1,
      username: c.username,
      displayName: c.display_name,
      stats: {
        apis: c.api_count,
        totalRequests: c.total_requests,
        totalRevenue: c.total_revenue,
        avgRating: Math.round((c.avg_rating || 0) / 20 * 10) / 10,
      },
      memberSince: c.member_since,
    })),
  });
});

// Most popular APIs (all time)
router.get('/apis', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  const apis = db.prepare(`
    SELECT a.name, a.slug, a.description, a.category,
           a.total_requests, a.total_revenue, a.avg_latency,
           a.endpoints_count, a.uptime, a.pricing_model,
           u.username as creator
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    WHERE a.status = 'active' AND a.visibility = 'public'
    ORDER BY a.total_requests DESC
    LIMIT ?
  `).all(limit);

  res.json({
    success: true,
    leaderboard: apis.map((a, idx) => ({
      rank: idx + 1,
      name: a.name,
      slug: a.slug,
      description: a.description?.slice(0, 100),
      category: a.category,
      creator: a.creator,
      stats: {
        requests: a.total_requests,
        revenue: a.total_revenue,
        latency: `${a.avg_latency}ms`,
        endpoints: a.endpoints_count,
        rating: Math.round((a.uptime || 0) / 20 * 10) / 10,
      },
      pricing: a.pricing_model,
    })),
  });
});

// Trending this week
router.get('/trending', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  const trending = db.prepare(`
    SELECT a.name, a.slug, a.category,
           COUNT(rl.id) as requests_this_week,
           u.username as creator
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    LEFT JOIN request_logs rl ON a.id = rl.api_id 
      AND rl.created_at > datetime('now', '-7 days')
    WHERE a.status = 'active' AND a.visibility = 'public'
    GROUP BY a.id
    ORDER BY requests_this_week DESC
    LIMIT ?
  `).all(limit);

  res.json({
    success: true,
    trending: trending.map((a, idx) => ({
      rank: idx + 1,
      name: a.name,
      slug: a.slug,
      category: a.category,
      creator: a.creator,
      requestsThisWeek: a.requests_this_week,
    })),
  });
});

// Top earning APIs
router.get('/revenue', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  const topEarners = db.prepare(`
    SELECT a.name, a.slug, a.category,
           a.total_revenue, a.pricing_model,
           a.monthly_price, a.price_per_request,
           u.username as creator
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    WHERE a.status = 'active' AND a.total_revenue > 0
    ORDER BY a.total_revenue DESC
    LIMIT ?
  `).all(limit);

  res.json({
    success: true,
    topEarners: topEarners.map((a, idx) => ({
      rank: idx + 1,
      name: a.name,
      slug: a.slug,
      category: a.category,
      creator: a.creator,
      revenue: a.total_revenue,
      pricing: {
        model: a.pricing_model,
        monthly: a.monthly_price,
        perRequest: a.price_per_request,
      },
    })),
  });
});

export default router;
