/**
 * Plugin System
 * Extensible middleware that can be attached to generated APIs
 * Allows custom authentication, transformation, caching, etc.
 */

import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

// Ensure plugins table
db.exec(`
  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Built-in plugin types
export const PLUGIN_TYPES = {
  'rate-limiter': {
    name: 'Advanced Rate Limiter',
    description: 'Sliding window rate limiting with burst support',
    configSchema: {
      windowMs: { type: 'number', default: 60000, description: 'Window in ms' },
      maxRequests: { type: 'number', default: 100, description: 'Max requests per window' },
      burstLimit: { type: 'number', default: 20, description: 'Max burst requests' },
      keyBy: { type: 'string', default: 'apiKey', enum: ['apiKey', 'ip', 'user'] },
    },
  },
  'cache': {
    name: 'Response Cache',
    description: 'Cache GET responses to reduce latency',
    configSchema: {
      ttl: { type: 'number', default: 300, description: 'Cache TTL in seconds' },
      methods: { type: 'array', default: ['GET'], description: 'Methods to cache' },
      maxSize: { type: 'number', default: 1000, description: 'Max cached entries' },
    },
  },
  'transform': {
    name: 'Response Transformer',
    description: 'Transform response format (rename fields, add computed fields)',
    configSchema: {
      renames: { type: 'object', default: {}, description: 'Field renames: {old: new}' },
      exclude: { type: 'array', default: [], description: 'Fields to exclude' },
      addTimestamp: { type: 'boolean', default: false },
      wrapInData: { type: 'boolean', default: true },
    },
  },
  'cors-custom': {
    name: 'Custom CORS',
    description: 'Fine-grained CORS control per API',
    configSchema: {
      origins: { type: 'array', default: ['*'], description: 'Allowed origins' },
      methods: { type: 'array', default: ['GET', 'POST', 'PUT', 'DELETE'] },
      headers: { type: 'array', default: ['Content-Type', 'Authorization', 'X-API-Key'] },
      credentials: { type: 'boolean', default: false },
      maxAge: { type: 'number', default: 86400 },
    },
  },
  'ip-whitelist': {
    name: 'IP Whitelist/Blacklist',
    description: 'Restrict access by IP address',
    configSchema: {
      mode: { type: 'string', default: 'whitelist', enum: ['whitelist', 'blacklist'] },
      ips: { type: 'array', default: [], description: 'IP addresses or CIDR ranges' },
      message: { type: 'string', default: 'Access denied from your IP' },
    },
  },
  'request-validator': {
    name: 'Request Validator',
    description: 'Custom validation rules beyond schema defaults',
    configSchema: {
      maxBodySize: { type: 'number', default: 102400, description: 'Max body in bytes' },
      requiredHeaders: { type: 'array', default: [] },
      blockedUserAgents: { type: 'array', default: [] },
    },
  },
  'analytics-enhanced': {
    name: 'Enhanced Analytics',
    description: 'Extra analytics: geo tracking, device detection, custom events',
    configSchema: {
      trackGeo: { type: 'boolean', default: true },
      trackDevice: { type: 'boolean', default: true },
      customEvents: { type: 'array', default: [] },
      retentionDays: { type: 'number', default: 90 },
    },
  },
  'webhook-on-change': {
    name: 'Auto-Webhook on Data Change',
    description: 'Trigger webhooks on create/update/delete',
    configSchema: {
      events: { type: 'array', default: ['create', 'update', 'delete'] },
      batchWindow: { type: 'number', default: 0, description: 'Batch events for N seconds' },
    },
  },
};


/**
 * Add a plugin to an API
 */
export function addPlugin(apiId, pluginType, config = {}) {
  const pluginDef = PLUGIN_TYPES[pluginType];
  if (!pluginDef) {
    throw new Error(`Unknown plugin type: ${pluginType}. Available: ${Object.keys(PLUGIN_TYPES).join(', ')}`);
  }

  // Merge with defaults
  const mergedConfig = {};
  for (const [key, schema] of Object.entries(pluginDef.configSchema)) {
    mergedConfig[key] = config[key] !== undefined ? config[key] : schema.default;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO plugins (id, api_id, name, type, config, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, apiId, pluginDef.name, pluginType, JSON.stringify(mergedConfig), config.priority || 0);

  return { id, type: pluginType, name: pluginDef.name, config: mergedConfig };
}

/**
 * Get all plugins for an API
 */
export function getApiPlugins(apiId) {
  return db.prepare(`
    SELECT * FROM plugins WHERE api_id = ? AND is_active = 1
    ORDER BY priority ASC
  `).all(apiId).map(p => ({
    ...p,
    config: JSON.parse(p.config),
  }));
}

/**
 * Execute plugin chain for a request
 */
export function executePluginChain(plugins, req, res) {
  for (const plugin of plugins) {
    const result = executePlugin(plugin, req, res);
    if (result.blocked) return result;
    if (result.modified) req = result.req;
  }
  return { blocked: false, req };
}

/**
 * Execute a single plugin
 */
function executePlugin(plugin, req, res) {
  const config = plugin.config;

  switch (plugin.type) {
    case 'rate-limiter':
      return executeRateLimiter(config, req);
    case 'cache':
      return executeCache(config, req, res);
    case 'ip-whitelist':
      return executeIpFilter(config, req);
    case 'request-validator':
      return executeValidator(config, req);
    case 'transform':
      return { blocked: false, transform: config };
    default:
      return { blocked: false };
  }
}

// In-memory rate limit store
const rateLimitStore = new Map();

function executeRateLimiter(config, req) {
  const key = config.keyBy === 'ip' ? req.ip 
    : config.keyBy === 'user' ? req.user?.userId 
    : req.headers['x-api-key'];

  const now = Date.now();
  const windowStart = now - config.windowMs;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }

  const requests = rateLimitStore.get(key).filter(t => t > windowStart);
  requests.push(now);
  rateLimitStore.set(key, requests);

  if (requests.length > config.maxRequests) {
    return { 
      blocked: true, 
      status: 429, 
      message: `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowMs/1000}s` 
    };
  }

  // Check burst
  const lastSecond = requests.filter(t => t > now - 1000);
  if (lastSecond.length > config.burstLimit) {
    return { blocked: true, status: 429, message: 'Burst limit exceeded' };
  }

  return { blocked: false };
}

// In-memory cache
const cacheStore = new Map();

function executeCache(config, req, res) {
  if (!config.methods.includes(req.method)) return { blocked: false };

  const cacheKey = `${req.method}:${req.path}:${req.query ? JSON.stringify(req.query) : ''}`;
  const cached = cacheStore.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < config.ttl * 1000) {
    return { blocked: true, status: 200, body: cached.data, headers: { 'X-Cache': 'HIT' } };
  }

  // Clean old entries if exceeding maxSize
  if (cacheStore.size > config.maxSize) {
    const oldest = [...cacheStore.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, Math.floor(config.maxSize / 4));
    oldest.forEach(([k]) => cacheStore.delete(k));
  }

  return { blocked: false, cacheKey };
}

function executeIpFilter(config, req) {
  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const isInList = config.ips.some(ip => clientIp.includes(ip));

  if (config.mode === 'whitelist' && !isInList) {
    return { blocked: true, status: 403, message: config.message };
  }
  if (config.mode === 'blacklist' && isInList) {
    return { blocked: true, status: 403, message: config.message };
  }

  return { blocked: false };
}

function executeValidator(config, req) {
  // Check body size
  const bodySize = JSON.stringify(req.body || '').length;
  if (bodySize > config.maxBodySize) {
    return { blocked: true, status: 413, message: 'Request body too large' };
  }

  // Check required headers
  for (const header of config.requiredHeaders) {
    if (!req.headers[header.toLowerCase()]) {
      return { blocked: true, status: 400, message: `Missing required header: ${header}` };
    }
  }

  // Check user agent
  const ua = req.headers['user-agent'] || '';
  for (const blocked of config.blockedUserAgents) {
    if (ua.toLowerCase().includes(blocked.toLowerCase())) {
      return { blocked: true, status: 403, message: 'Access denied' };
    }
  }

  return { blocked: false };
}

/**
 * Remove a plugin
 */
export function removePlugin(pluginId, apiId) {
  const result = db.prepare('DELETE FROM plugins WHERE id = ? AND api_id = ?')
    .run(pluginId, apiId);
  return result.changes > 0;
}

/**
 * Toggle plugin active state
 */
export function togglePlugin(pluginId, isActive) {
  db.prepare('UPDATE plugins SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, pluginId);
}
