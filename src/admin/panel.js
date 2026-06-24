/**
 * Admin Panel - Platform Management
 * Only accessible by users with admin role
 */

import db from '../utils/database.js';

/**
 * Get platform-wide statistics
 */
export function getPlatformStats() {
  const users = db.prepare('SELECT COUNT(*) as total FROM users').get();
  const apis = db.prepare("SELECT COUNT(*) as total FROM apis WHERE status = 'active'").get();
  const requests = db.prepare('SELECT COUNT(*) as total FROM request_logs').get();
  const revenue = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM revenue_events').get();

  const usersByPlan = db.prepare(`
    SELECT plan, COUNT(*) as count FROM users GROUP BY plan
  `).all();

  const requestsToday = db.prepare(`
    SELECT COUNT(*) as total FROM request_logs
    WHERE created_at > datetime('now', '-24 hours')
  `).get();

  const newUsersToday = db.prepare(`
    SELECT COUNT(*) as total FROM users
    WHERE created_at > datetime('now', '-24 hours')
  `).get();

  const topApis = db.prepare(`
    SELECT a.name, a.slug, a.total_requests, u.username as creator
    FROM apis a JOIN users u ON a.owner_id = u.id
    ORDER BY a.total_requests DESC LIMIT 10
  `).all();

  return {
    overview: {
      totalUsers: users.total,
      totalApis: apis.total,
      totalRequests: requests.total,
      totalRevenue: revenue.total,
      requestsToday: requestsToday.total,
      newUsersToday: newUsersToday.total,
    },
    usersByPlan,
    topApis,
  };
}

/**
 * List all users with admin view
 */
export function listAllUsers(options = {}) {
  const { page = 1, limit = 50, search = null } = options;
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = { limit, offset };

  if (search) {
    where += ' AND (email LIKE @search OR username LIKE @search)';
    params.search = `%${search}%`;
  }

  const users = db.prepare(`
    SELECT u.id, u.email, u.username, u.display_name, u.plan, u.created_at,
           COUNT(a.id) as api_count,
           COALESCE(SUM(a.total_requests), 0) as total_requests
    FROM users u
    LEFT JOIN apis a ON u.id = a.owner_id
    WHERE ${where}
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT @limit OFFSET @offset
  `).all(params);

  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(params);

  return { users, total: total.c, page, limit };
}

/**
 * Moderate an API (approve, suspend, feature)
 */
export function moderateApi(apiId, action, reason) {
  const actions = {
    approve: { status: 'active', visibility: 'public' },
    suspend: { status: 'suspended', visibility: 'private' },
    feature: { status: 'active', visibility: 'featured' },
    unfeature: { status: 'active', visibility: 'public' },
  };

  const update = actions[action];
  if (!update) throw new Error(`Invalid action: ${action}`);

  db.prepare(`
    UPDATE apis SET status = ?, visibility = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(update.status, update.visibility, apiId);

  return { apiId, action, reason, timestamp: new Date().toISOString() };
}

/**
 * Ban/suspend a user
 */
export function moderateUser(userId, action) {
  const planMap = { ban: 'banned', suspend: 'suspended', restore: 'free' };
  const plan = planMap[action];
  if (!plan) throw new Error('Invalid action');

  db.prepare("UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?")
    .run(plan, userId);

  if (action === 'ban' || action === 'suspend') {
    db.prepare("UPDATE apis SET status = 'inactive' WHERE owner_id = ?").run(userId);
  }

  return { userId, action, timestamp: new Date().toISOString() };
}

/**
 * Get platform revenue breakdown
 */
export function getRevenueBreakdown(period = '30d') {
  const periodMap = { '7d': '-7 days', '30d': '-30 days', '90d': '-90 days', '1y': '-1 year' };
  const timeFilter = periodMap[period] || periodMap['30d'];

  const daily = db.prepare(`
    SELECT date(created_at) as date, SUM(amount) as revenue, COUNT(*) as transactions
    FROM revenue_events
    WHERE created_at > datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(timeFilter);

  const byApi = db.prepare(`
    SELECT a.name, a.slug, SUM(r.amount) as revenue
    FROM revenue_events r
    JOIN apis a ON r.api_id = a.id
    WHERE r.created_at > datetime('now', ?)
    GROUP BY a.id
    ORDER BY revenue DESC
    LIMIT 20
  `).all(timeFilter);

  return { daily, byApi, period };
}
