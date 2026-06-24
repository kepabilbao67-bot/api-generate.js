/**
 * Admin Routes (requires admin role)
 * GET  /api/v1/admin/stats           - Platform stats
 * GET  /api/v1/admin/users           - List all users
 * POST /api/v1/admin/users/:id/moderate - Moderate user
 * POST /api/v1/admin/apis/:id/moderate  - Moderate API
 * GET  /api/v1/admin/revenue         - Revenue breakdown
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPlatformStats, listAllUsers, moderateApi, moderateUser, getRevenueBreakdown } from '../admin/panel.js';
import db from '../utils/database.js';

const router = Router();

// Admin-only middleware
function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(req.user.userId);
  if (!user || user.plan !== 'enterprise') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Platform statistics
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const stats = getPlatformStats();
  res.json({ success: true, ...stats });
});

// List all users
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const { page, limit, search } = req.query;
  const result = listAllUsers({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    search,
  });
  res.json({ success: true, ...result });
});

// Moderate user
router.post('/users/:id/moderate', requireAuth, requireAdmin, (req, res) => {
  try {
    const { action } = req.body;
    const result = moderateUser(req.params.id, action);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Moderate API
router.post('/apis/:id/moderate', requireAuth, requireAdmin, (req, res) => {
  try {
    const { action, reason } = req.body;
    const result = moderateApi(req.params.id, action, reason);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Revenue breakdown
router.get('/revenue', requireAuth, requireAdmin, (req, res) => {
  const period = req.query.period || '30d';
  const breakdown = getRevenueBreakdown(period);
  res.json({ success: true, ...breakdown });
});

export default router;
