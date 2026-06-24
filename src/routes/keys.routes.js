/**
 * API Key Management Routes
 * GET    /api/v1/keys                - List all my keys
 * POST   /api/v1/keys/:apiId         - Create new key
 * DELETE /api/v1/keys/:keyId         - Revoke key
 * POST   /api/v1/keys/:keyId/rotate  - Rotate (new key, old one expires in 24h)
 * PUT    /api/v1/keys/:keyId         - Update key settings
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createApiKey, listUserApiKeys, revokeApiKey, generateApiKey } from '../auth/api-keys.js';
import db from '../utils/database.js';

const router = Router();

// List all keys
router.get('/', requireAuth, (req, res) => {
  const keys = listUserApiKeys(req.user.userId);
  // Mask keys (show only first 12 + last 4 chars)
  const masked = keys.map(k => ({
    ...k,
    key_value: k.key_value.slice(0, 12) + '...' + k.key_value.slice(-4),
  }));
  res.json({ success: true, keys: masked, count: keys.length });
});

// Create new key for an API
router.post('/:apiId', requireAuth, (req, res) => {
  try {
    const { name, permissions, rateLimit, expiresIn } = req.body;
    let expiresAt = null;
    if (expiresIn) {
      const days = parseInt(expiresIn);
      expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    }

    const key = createApiKey(req.user.userId, req.params.apiId, {
      name: name || 'New Key',
      permissions: permissions || 'read,write',
      rateLimit: rateLimit || 1000,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      key,
      warning: 'Save this key now! It will not be shown again in full.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rotate key (create new, schedule old for expiry)
router.post('/:keyId/rotate', requireAuth, (req, res) => {
  const oldKey = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?')
    .get(req.params.keyId, req.user.userId);
  if (!oldKey) return res.status(404).json({ error: 'Key not found' });

  // Create new key
  const newKey = createApiKey(req.user.userId, oldKey.api_id, {
    name: `${oldKey.name} (rotated)`,
    permissions: oldKey.permissions,
    rateLimit: oldKey.rate_limit,
  });

  // Set old key to expire in 24 hours
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  db.prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?').run(expiresAt, oldKey.id);

  res.json({
    success: true,
    message: 'Key rotated! Old key expires in 24 hours.',
    newKey,
    oldKeyExpires: expiresAt,
  });
});

// Revoke key
router.delete('/:keyId', requireAuth, (req, res) => {
  const revoked = revokeApiKey(req.params.keyId, req.user.userId);
  if (!revoked) return res.status(404).json({ error: 'Key not found' });
  res.json({ success: true, message: 'Key revoked' });
});

// Update key settings
router.put('/:keyId', requireAuth, (req, res) => {
  const { name, rateLimit, permissions } = req.body;
  const updates = [];
  const params = { id: req.params.keyId };

  if (name) { updates.push('name = @name'); params.name = name; }
  if (rateLimit) { updates.push('rate_limit = @rateLimit'); params.rateLimit = rateLimit; }
  if (permissions) { updates.push('permissions = @permissions'); params.permissions = permissions; }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  db.prepare(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = @id AND user_id = '${req.user.userId}'`).run(params);
  res.json({ success: true, message: 'Key updated' });
});

export default router;
