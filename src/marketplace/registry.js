/**
 * API Marketplace Registry
 * Discover, search, and browse published APIs
 */

import db from '../utils/database.js';

/**
 * List APIs in the marketplace with filters and pagination
 */
export function listMarketplaceAPIs(options = {}) {
  const {
    page = 1,
    limit = 20,
    category = null,
    search = null,
    sort = 'popular',
    pricingModel = null,
    tags = null,
  } = options;

  const offset = (page - 1) * limit;
  let where = "WHERE a.status = 'active' AND a.visibility = 'public'";
  const params = {};

  if (category) {
    where += ' AND a.category = @category';
    params.category = category;
  }

  if (search) {
    where += ' AND (a.name LIKE @search OR a.description LIKE @search OR a.tags LIKE @search)';
    params.search = `%${search}%`;
  }

  if (pricingModel) {
    where += ' AND a.pricing_model = @pricingModel';
    params.pricingModel = pricingModel;
  }

  if (tags) {
    where += ' AND a.tags LIKE @tags';
    params.tags = `%${tags}%`;
  }

  const sortMap = {
    popular: 'a.total_requests DESC',
    newest: 'a.created_at DESC',
    revenue: 'a.total_revenue DESC',
    name: 'a.name ASC',
    rating: 'a.uptime DESC',
  };
  const orderBy = sortMap[sort] || sortMap.popular;

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM apis a ${where}
  `).get(params);

  // Get paginated results
  const apis = db.prepare(`
    SELECT a.id, a.name, a.slug, a.description, a.category, a.version,
           a.pricing_model, a.price_per_request, a.monthly_price,
           a.endpoints_count, a.total_requests, a.avg_latency, a.uptime,
           a.tags, a.created_at,
           u.username as creator, u.display_name as creator_name
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    ${where}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  return {
    data: apis.map(formatApiListing),
    meta: {
      total: countResult.total,
      page,
      limit,
      pages: Math.ceil(countResult.total / limit),
      sort,
    },
  };
}


/**
 * Get detailed API info (single API page)
 */
export function getApiDetails(slug) {
  const api = db.prepare(`
    SELECT a.*, u.username as creator, u.display_name as creator_name, u.bio as creator_bio
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    WHERE a.slug = ? AND a.status = 'active'
  `).get(slug);

  if (!api) return null;

  // Get subscriber count
  const subscribers = db.prepare(
    "SELECT COUNT(*) as count FROM subscriptions WHERE api_id = ? AND status = 'active'"
  ).get(api.id);

  // Get recent request stats (last 24h)
  const recentStats = db.prepare(`
    SELECT COUNT(*) as requests_24h,
           AVG(latency_ms) as avg_latency_24h
    FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', '-1 day')
  `).get(api.id);

  return {
    ...formatApiListing(api),
    fullDescription: api.description,
    documentation: api.documentation ? JSON.parse(api.documentation) : null,
    schema: JSON.parse(api.schema_definition),
    subscribers: subscribers.count,
    recentStats: {
      requests24h: recentStats.requests_24h,
      avgLatency24h: Math.round(recentStats.avg_latency_24h || 0),
    },
    creator: {
      username: api.creator,
      displayName: api.creator_name,
      bio: api.creator_bio,
    },
  };
}

/**
 * Get featured/trending APIs for homepage
 */
export function getFeaturedAPIs() {
  const trending = db.prepare(`
    SELECT a.id, a.name, a.slug, a.description, a.category,
           a.pricing_model, a.total_requests, a.endpoints_count,
           a.avg_latency, a.uptime, a.tags,
           u.username as creator
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    WHERE a.status = 'active' AND a.visibility = 'public'
    ORDER BY a.total_requests DESC
    LIMIT 12
  `).all();

  const newest = db.prepare(`
    SELECT a.id, a.name, a.slug, a.description, a.category,
           a.pricing_model, a.total_requests, a.endpoints_count,
           a.avg_latency, a.uptime, a.tags,
           u.username as creator
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    WHERE a.status = 'active' AND a.visibility = 'public'
    ORDER BY a.created_at DESC
    LIMIT 12
  `).all();

  return {
    trending: trending.map(formatApiListing),
    newest: newest.map(formatApiListing),
  };
}

/**
 * Get all available categories with counts
 */
export function getCategories() {
  return db.prepare(`
    SELECT category, COUNT(*) as count
    FROM apis
    WHERE status = 'active' AND visibility = 'public'
    GROUP BY category
    ORDER BY count DESC
  `).all();
}

/**
 * Subscribe to an API
 */
export function subscribeToApi(userId, apiId, plan = 'free') {
  const existing = db.prepare(
    "SELECT id FROM subscriptions WHERE user_id = ? AND api_id = ? AND status = 'active'"
  ).get(userId, apiId);

  if (existing) {
    throw new Error('Already subscribed to this API');
  }

  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  const limits = { free: 1000, basic: 10000, pro: 100000, unlimited: -1 };

  db.prepare(`
    INSERT INTO subscriptions (id, user_id, api_id, plan, monthly_limit)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, apiId, plan, limits[plan] || 1000);

  return { id, plan, monthlyLimit: limits[plan] || 1000 };
}

/**
 * Get user's subscriptions
 */
export function getUserSubscriptions(userId) {
  return db.prepare(`
    SELECT s.*, a.name as api_name, a.slug as api_slug,
           a.description as api_description, u.username as api_creator
    FROM subscriptions s
    JOIN apis a ON s.api_id = a.id
    JOIN users u ON a.owner_id = u.id
    WHERE s.user_id = ? AND s.status = 'active'
    ORDER BY s.started_at DESC
  `).all(userId);
}

/**
 * Format API for listing display
 */
function formatApiListing(api) {
  return {
    id: api.id,
    name: api.name,
    slug: api.slug,
    description: api.description?.slice(0, 200),
    category: api.category,
    version: api.version,
    pricing: {
      model: api.pricing_model,
      perRequest: api.price_per_request,
      monthly: api.monthly_price,
    },
    stats: {
      endpoints: api.endpoints_count,
      totalRequests: api.total_requests,
      avgLatency: `${Math.round(api.avg_latency || 0)}ms`,
      uptime: `${api.uptime || 100}%`,
    },
    tags: api.tags ? JSON.parse(api.tags) : [],
    creator: api.creator,
    createdAt: api.created_at,
  };
}
