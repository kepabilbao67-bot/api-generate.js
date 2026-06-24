/**
 * Analytics Dashboard
 * Provides comprehensive metrics for API owners
 */

import db from '../utils/database.js';

/**
 * Get overview stats for an API owner
 */
export function getOwnerOverview(userId) {
  const apis = db.prepare('SELECT id, name, slug FROM apis WHERE owner_id = ?').all(userId);
  const apiIds = apis.map(a => a.id);

  if (apiIds.length === 0) {
    return { apis: [], totalRequests: 0, avgLatency: 0, uptime: 100, revenue: 0 };
  }

  const placeholders = apiIds.map(() => '?').join(',');

  const totals = db.prepare(`
    SELECT 
      COUNT(*) as total_requests,
      AVG(latency_ms) as avg_latency,
      SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as success_count
    FROM request_logs
    WHERE api_id IN (${placeholders})
  `).get(...apiIds);

  const revenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM revenue_events
    WHERE api_id IN (${placeholders})
  `).get(...apiIds);

  return {
    totalApis: apis.length,
    totalRequests: totals.total_requests,
    avgLatency: Math.round(totals.avg_latency || 0),
    successRate: totals.total_requests > 0 
      ? ((totals.success_count / totals.total_requests) * 100).toFixed(1) 
      : 100,
    totalRevenue: revenue.total,
  };
}

/**
 * Get detailed analytics for a specific API
 */
export function getApiAnalytics(apiId, period = '7d') {
  const periodMap = {
    '1h': '-1 hour',
    '24h': '-1 day',
    '7d': '-7 days',
    '30d': '-30 days',
    '90d': '-90 days',
  };
  const timeFilter = periodMap[period] || periodMap['7d'];

  // Request count over time
  const requestsOverTime = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d %H:00', created_at) as timestamp,
      COUNT(*) as requests,
      AVG(latency_ms) as avg_latency,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', ?)
    GROUP BY timestamp
    ORDER BY timestamp ASC
  `).all(apiId, timeFilter);

  // Top endpoints
  const topEndpoints = db.prepare(`
    SELECT 
      method, endpoint,
      COUNT(*) as requests,
      AVG(latency_ms) as avg_latency,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', ?)
    GROUP BY method, endpoint
    ORDER BY requests DESC
    LIMIT 10
  `).all(apiId, timeFilter);

  // Status code distribution
  const statusCodes = db.prepare(`
    SELECT 
      status_code,
      COUNT(*) as count
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', ?)
    GROUP BY status_code
    ORDER BY count DESC
  `).all(apiId, timeFilter);

  // Latency percentiles (approximation)
  const latencies = db.prepare(`
    SELECT latency_ms
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', ?)
    ORDER BY latency_ms ASC
  `).all(apiId, timeFilter);

  const p50 = getPercentile(latencies, 50);
  const p95 = getPercentile(latencies, 95);
  const p99 = getPercentile(latencies, 99);

  // Geographic distribution (based on first 2 chars of IP as proxy)
  const topConsumers = db.prepare(`
    SELECT 
      api_key_id,
      COUNT(*) as requests
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', ?) AND api_key_id IS NOT NULL
    GROUP BY api_key_id
    ORDER BY requests DESC
    LIMIT 10
  `).all(apiId, timeFilter);

  return {
    period,
    requestsOverTime,
    topEndpoints,
    statusCodes,
    latency: { p50, p95, p99 },
    topConsumers,
    summary: {
      totalRequests: requestsOverTime.reduce((sum, r) => sum + r.requests, 0),
      totalErrors: requestsOverTime.reduce((sum, r) => sum + r.errors, 0),
      avgLatency: Math.round(latencies.reduce((sum, l) => sum + l.latency_ms, 0) / (latencies.length || 1)),
    },
  };
}


/**
 * Get real-time stats (last 5 minutes)
 */
export function getRealTimeStats(apiId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as requests,
      AVG(latency_ms) as avg_latency,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
      MAX(latency_ms) as max_latency,
      MIN(latency_ms) as min_latency
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', '-5 minutes')
  `).get(apiId);

  const requestsPerSecond = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d %H:%M:%S', created_at) as second,
      COUNT(*) as count
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', '-1 minute')
    GROUP BY second
    ORDER BY second DESC
  `).all(apiId);

  return {
    last5Minutes: {
      requests: stats.requests,
      avgLatency: Math.round(stats.avg_latency || 0),
      maxLatency: Math.round(stats.max_latency || 0),
      minLatency: Math.round(stats.min_latency || 0),
      errors: stats.errors,
      errorRate: stats.requests > 0 ? ((stats.errors / stats.requests) * 100).toFixed(1) : 0,
    },
    requestsPerSecond: requestsPerSecond.map(r => ({
      timestamp: r.second,
      count: r.count,
    })),
  };
}

/**
 * Get usage breakdown by consumer
 */
export function getConsumerUsage(apiId, period = '30d') {
  const periodMap = { '7d': '-7 days', '30d': '-30 days', '90d': '-90 days' };
  const timeFilter = periodMap[period] || periodMap['30d'];

  return db.prepare(`
    SELECT 
      ak.name as key_name,
      u.username as consumer,
      COUNT(rl.id) as total_requests,
      AVG(rl.latency_ms) as avg_latency,
      SUM(CASE WHEN rl.status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM request_logs rl
    JOIN api_keys ak ON rl.api_key_id = ak.id
    JOIN users u ON ak.user_id = u.id
    WHERE rl.api_id = ? AND rl.created_at > datetime('now', ?)
    GROUP BY ak.id
    ORDER BY total_requests DESC
  `).all(apiId, timeFilter);
}

/**
 * Get error analytics
 */
export function getErrorAnalytics(apiId, period = '7d') {
  const periodMap = { '24h': '-1 day', '7d': '-7 days', '30d': '-30 days' };
  const timeFilter = periodMap[period] || periodMap['7d'];

  const errors = db.prepare(`
    SELECT 
      status_code,
      method,
      endpoint,
      COUNT(*) as count,
      MAX(created_at) as last_occurred
    FROM request_logs
    WHERE api_id = ? AND status_code >= 400 AND created_at > datetime('now', ?)
    GROUP BY status_code, method, endpoint
    ORDER BY count DESC
    LIMIT 20
  `).all(apiId, timeFilter);

  const errorRate = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d', created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', ?)
    GROUP BY date
    ORDER BY date ASC
  `).all(apiId, timeFilter);

  return { errors, errorRate };
}

/**
 * Helper: Calculate percentile from sorted array
 */
function getPercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return Math.round(sortedArray[Math.max(0, index)]?.latency_ms || 0);
}
