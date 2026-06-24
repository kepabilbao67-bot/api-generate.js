/**
 * Server-Sent Events (SSE) - Real-time notifications
 * GET /api/v1/events/stream       - Subscribe to real-time events
 * GET /api/v1/events/stream/:slug - Events for specific API
 * 
 * Events: api.request, api.error, subscription.new,
 *         review.new, revenue.received, key.created
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Active SSE connections
const connections = new Map();

// Subscribe to real-time events (all user's APIs)
router.get('/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const userId = req.user.userId;
  const connectionId = `${userId}_${Date.now()}`;

  // Store connection
  if (!connections.has(userId)) connections.set(userId, new Map());
  connections.get(userId).set(connectionId, res);

  // Send initial connection event
  sendEvent(res, 'connected', {
    message: 'Connected to real-time events',
    connectionId,
    timestamp: new Date().toISOString(),
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    sendEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    connections.get(userId)?.delete(connectionId);
    if (connections.get(userId)?.size === 0) connections.delete(userId);
  });
});

// Subscribe to events for a specific API
router.get('/stream/:slug', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const key = `api_${req.params.slug}_${req.user.userId}`;
  const connectionId = `${key}_${Date.now()}`;

  if (!connections.has(key)) connections.set(key, new Map());
  connections.get(key).set(connectionId, res);

  sendEvent(res, 'connected', { api: req.params.slug, timestamp: new Date().toISOString() });

  const heartbeat = setInterval(() => sendEvent(res, 'heartbeat', {}), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    connections.get(key)?.delete(connectionId);
    if (connections.get(key)?.size === 0) connections.delete(key);
  });
});

// Get connection status
router.get('/status', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const userConns = connections.get(userId)?.size || 0;
  res.json({
    success: true,
    activeConnections: userConns,
    totalPlatformConnections: [...connections.values()].reduce((s, m) => s + m.size, 0),
  });
});

/**
 * Send SSE event to a response
 */
function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Broadcast event to a user (called from other modules)
 */
export function broadcastToUser(userId, event, data) {
  const userConns = connections.get(userId);
  if (!userConns) return;
  userConns.forEach(res => sendEvent(res, event, data));
}

/**
 * Broadcast event for a specific API
 */
export function broadcastToApi(slug, userId, event, data) {
  const key = `api_${slug}_${userId}`;
  const apiConns = connections.get(key);
  if (!apiConns) return;
  apiConns.forEach(res => sendEvent(res, event, data));
}

export default router;
