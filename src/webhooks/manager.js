/**
 * Webhook Manager
 * Send real-time notifications to API consumers when events occur
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../utils/database.js';

// Ensure webhooks table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_triggered_at TEXT,
    failure_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT,
    status_code INTEGER,
    response TEXT,
    success INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
  );
`);


/**
 * Register a new webhook
 */
export function registerWebhook(userId, apiId, url, events = ['*']) {
  const id = uuidv4();
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  db.prepare(`
    INSERT INTO webhooks (id, api_id, user_id, url, events, secret)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, apiId, userId, url, JSON.stringify(events), secret);

  return { id, url, events, secret, note: 'Save the secret - use it to verify webhook signatures' };
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(apiId, event, payload) {
  const webhooks = db.prepare(`
    SELECT * FROM webhooks 
    WHERE api_id = ? AND is_active = 1 AND failure_count < 5
  `).all(apiId);

  const results = [];

  for (const webhook of webhooks) {
    const events = JSON.parse(webhook.events);
    if (!events.includes('*') && !events.includes(event)) continue;

    const result = await sendWebhook(webhook, event, payload);
    results.push(result);
  }

  return results;
}

/**
 * Send a single webhook
 */
async function sendWebhook(webhook, event, payload) {
  const timestamp = Date.now();
  const body = JSON.stringify({
    id: uuidv4(),
    event,
    timestamp,
    apiId: webhook.api_id,
    data: payload,
  });

  // Create signature
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Event': event,
        'User-Agent': 'APIForge-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const success = response.ok;

    // Log the webhook delivery
    db.prepare(`
      INSERT INTO webhook_logs (webhook_id, event, payload, status_code, success)
      VALUES (?, ?, ?, ?, ?)
    `).run(webhook.id, event, body, response.status, success ? 1 : 0);

    if (success) {
      db.prepare(`
        UPDATE webhooks SET last_triggered_at = datetime('now'), failure_count = 0 WHERE id = ?
      `).run(webhook.id);
    } else {
      db.prepare(`
        UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?
      `).run(webhook.id);
    }

    return { webhookId: webhook.id, success, statusCode: response.status };
  } catch (err) {
    db.prepare(`
      INSERT INTO webhook_logs (webhook_id, event, payload, status_code, success)
      VALUES (?, ?, ?, ?, 0)
    `).run(webhook.id, event, body, 0);

    db.prepare(`
      UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?
    `).run(webhook.id);

    return { webhookId: webhook.id, success: false, error: err.message };
  }
}

/**
 * List webhooks for a user/api
 */
export function listWebhooks(userId, apiId) {
  return db.prepare(`
    SELECT id, api_id, url, events, is_active, last_triggered_at, failure_count, created_at
    FROM webhooks
    WHERE user_id = ? AND api_id = ?
    ORDER BY created_at DESC
  `).all(userId, apiId);
}

/**
 * Delete a webhook
 */
export function deleteWebhook(webhookId, userId) {
  const result = db.prepare('DELETE FROM webhooks WHERE id = ? AND user_id = ?')
    .run(webhookId, userId);
  return result.changes > 0;
}

/**
 * Get webhook delivery history
 */
export function getWebhookLogs(webhookId, limit = 20) {
  return db.prepare(`
    SELECT * FROM webhook_logs
    WHERE webhook_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(webhookId, limit);
}
