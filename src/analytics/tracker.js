/**
 * Analytics Tracker
 * Logs every API request and provides real-time metrics
 */

import db from '../utils/database.js';

/**
 * Log an API request
 */
export function logRequest({ apiId, apiKeyId, method, endpoint, statusCode, latencyMs, ipAddress, userAgent, requestBody, responseSize }) {
  db.prepare(`
    INSERT INTO request_logs (api_id, api_key_id, method, endpoint, status_code, latency_ms, ip_address, user_agent, request_body, response_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(apiId, apiKeyId, method, endpoint, statusCode, latencyMs, ipAddress, userAgent, requestBody ? JSON.stringify(requestBody) : null, responseSize);

  // Update API stats (async-style but sync for SQLite)
  db.prepare(`
    UPDATE apis SET 
      total_requests = total_requests + 1,
      avg_latency = (avg_latency * total_requests + ?) / (total_requests + 1),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(latencyMs, apiId);
}

/**
 * Analytics middleware - wraps request to capture metrics
 */
export function analyticsMiddleware(apiId, apiKeyId) {
  return (req, res, next) => {
    const startTime = Date.now();

    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
      const latencyMs = Date.now() - startTime;
      const responseSize = body ? Buffer.byteLength(body) : 0;

      // Log asynchronously (non-blocking)
      setImmediate(() => {
        logRequest({
          apiId,
          apiKeyId,
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          latencyMs,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestBody: req.body,
          responseSize,
        });
      });

      originalSend.call(this, body);
    };

    next();
  };
}
