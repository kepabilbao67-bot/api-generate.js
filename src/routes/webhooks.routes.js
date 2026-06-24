/**
 * Webhook Routes
 * POST   /api/v1/webhooks              - Register webhook
 * GET    /api/v1/webhooks/:apiId       - List webhooks
 * DELETE /api/v1/webhooks/:id          - Delete webhook
 * GET    /api/v1/webhooks/:id/logs     - Delivery history
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { registerWebhook, listWebhooks, deleteWebhook, getWebhookLogs } from '../webhooks/manager.js';

const router = Router();

// Register a new webhook
router.post('/', requireAuth, (req, res) => {
  try {
    const { apiId, url, events } = req.body;

    if (!apiId || !url) {
      return res.status(400).json({ error: 'apiId and url are required' });
    }

    const webhook = registerWebhook(req.user.userId, apiId, url, events);
    res.status(201).json({ success: true, webhook });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List webhooks for an API
router.get('/:apiId', requireAuth, (req, res) => {
  const webhooks = listWebhooks(req.user.userId, req.params.apiId);
  res.json({ success: true, webhooks });
});

// Delete a webhook
router.delete('/:id', requireAuth, (req, res) => {
  const deleted = deleteWebhook(req.params.id, req.user.userId);
  if (!deleted) return res.status(404).json({ error: 'Webhook not found' });
  res.json({ success: true, message: 'Webhook deleted' });
});

// Get delivery history
router.get('/:id/logs', requireAuth, (req, res) => {
  const logs = getWebhookLogs(req.params.id, parseInt(req.query.limit) || 20);
  res.json({ success: true, logs });
});

export default router;
