/**
 * Authentication Middleware
 * JWT and API Key authentication for routes
 */

import { verifyToken } from '../auth/jwt.js';
import { validateApiKey, incrementKeyUsage } from '../auth/api-keys.js';

/**
 * Require JWT authentication
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header. Use: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];
  const result = verifyToken(token);

  if (!result.valid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }

  req.user = result.decoded;
  next();
}

/**
 * Require API Key authentication (for consuming generated APIs)
 */
export function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Include X-API-Key header or apiKey query parameter.',
    });
  }

  const result = validateApiKey(apiKey);

  if (!result.valid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: result.error,
    });
  }

  // Increment usage
  incrementKeyUsage(result.keyId);

  req.apiKeyInfo = result;
  next();
}

/**
 * Optional auth - doesn't fail if no token, but attaches user if present
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const result = verifyToken(token);
    if (result.valid) {
      req.user = result.decoded;
    }
  }

  next();
}

/**
 * Rate limiting middleware per API key
 */
export function apiRateLimit(req, res, next) {
  if (req.apiKeyInfo) {
    const { requestsUsed, rateLimit } = req.apiKeyInfo;
    const remaining = rateLimit - requestsUsed;

    res.setHeader('X-RateLimit-Limit', rateLimit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
    res.setHeader('X-RateLimit-Reset', getResetTime());

    if (remaining <= 0) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `You have exceeded ${rateLimit} requests. Upgrade your plan for higher limits.`,
        retryAfter: getResetTime(),
      });
    }
  }
  next();
}

function getResetTime() {
  const now = new Date();
  const endOfHour = new Date(now);
  endOfHour.setHours(endOfHour.getHours() + 1, 0, 0, 0);
  return endOfHour.toISOString();
}
