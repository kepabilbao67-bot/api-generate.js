/**
 * API Key Management
 * Generate, validate, and manage API keys for consumers
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../utils/database.js';

/**
 * Generate a new API key with prefix for easy identification
 * Format: afk_live_xxxxxxxxxxxxxxxxxxxx (for live keys)
 *         afk_test_xxxxxxxxxxxxxxxxxxxx (for test keys)
 */
export function generateApiKey(environment = 'live') {
  const prefix = `afk_${environment}_`;
  const key = crypto.randomBytes(24).toString('hex');
  return `${prefix}${key}`;
}

/**
 * Create and store a new API key
 */
export function createApiKey(userId, apiId, options = {}) {
  const keyValue = generateApiKey(options.environment || 'live');
  const id = uuidv4();

  const apiKey = {
    id,
    user_id: userId,
    api_id: apiId,
    key_value: keyValue,
    name: options.name || 'Default Key',
    permissions: options.permissions || 'read',
    rate_limit: options.rateLimit || 100,
    expires_at: options.expiresAt || null,
  };

  db.prepare(`
    INSERT INTO api_keys (id, user_id, api_id, key_value, name, permissions, rate_limit, expires_at)
    VALUES (@id, @user_id, @api_id, @key_value, @name, @permissions, @rate_limit, @expires_at)
  `).run(apiKey);

  return {
    id,
    key: keyValue,
    name: apiKey.name,
    permissions: apiKey.permissions,
    rateLimit: apiKey.rate_limit,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate an API key and return associated info
 */
export function validateApiKey(keyValue) {
  const apiKey = db.prepare(`
    SELECT ak.*, a.slug as api_slug, a.name as api_name, a.status as api_status,
           u.username as owner_username
    FROM api_keys ak
    JOIN apis a ON ak.api_id = a.id
    JOIN users u ON ak.user_id = u.id
    WHERE ak.key_value = ? AND ak.is_active = 1
  `).get(keyValue);

  if (!apiKey) {
    return { valid: false, error: 'Invalid or inactive API key' };
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Check rate limit
  if (apiKey.requests_used >= apiKey.rate_limit) {
    return { valid: false, error: 'Rate limit exceeded for this key' };
  }

  return {
    valid: true,
    keyId: apiKey.id,
    userId: apiKey.user_id,
    apiId: apiKey.api_id,
    apiSlug: apiKey.api_slug,
    permissions: apiKey.permissions,
    rateLimit: apiKey.rate_limit,
    requestsUsed: apiKey.requests_used,
  };
}

/**
 * Increment request counter for an API key
 */
export function incrementKeyUsage(keyId) {
  db.prepare('UPDATE api_keys SET requests_used = requests_used + 1 WHERE id = ?').run(keyId);
}

/**
 * Revoke an API key
 */
export function revokeApiKey(keyId, userId) {
  const result = db.prepare(
    'UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?'
  ).run(keyId, userId);
  return result.changes > 0;
}

/**
 * List all API keys for a user
 */
export function listUserApiKeys(userId) {
  return db.prepare(`
    SELECT ak.id, ak.name, ak.key_value, ak.permissions, ak.rate_limit,
           ak.requests_used, ak.is_active, ak.created_at, ak.expires_at,
           a.name as api_name, a.slug as api_slug
    FROM api_keys ak
    JOIN apis a ON ak.api_id = a.id
    WHERE ak.user_id = ?
    ORDER BY ak.created_at DESC
  `).all(userId);
}

/**
 * Reset monthly usage for all keys (called by cron)
 */
export function resetMonthlyUsage() {
  db.prepare('UPDATE api_keys SET requests_used = 0').run();
}
