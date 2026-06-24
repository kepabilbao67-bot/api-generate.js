/**
 * Custom Pricing Tiers per API
 * Allows creators to define custom plans for their APIs
 * 
 * POST /api/v1/pricing/:slug           - Create tier
 * GET  /api/v1/pricing/:slug           - List tiers
 * PUT  /api/v1/pricing/:slug/:tierId   - Update tier
 * DELETE /api/v1/pricing/:slug/:tierId - Delete tier
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS pricing_tiers (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    billing_period TEXT DEFAULT 'monthly',
    requests_limit INTEGER DEFAULT -1,
    rate_limit INTEGER DEFAULT 100,
    features TEXT DEFAULT '[]',
    is_popular INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Create pricing tier
router.post('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { name, price, billingPeriod, requestsLimit, rateLimit, features, isPopular } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO pricing_tiers (id, api_id, name, price, billing_period, requests_limit, rate_limit, features, is_popular)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, api.id, name, price, billingPeriod || 'monthly', requestsLimit || -1, rateLimit || 100, JSON.stringify(features || []), isPopular ? 1 : 0);

  res.status(201).json({ success: true, tier: { id, name, price, billingPeriod: billingPeriod || 'monthly' } });
});

// List pricing tiers for an API
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id, name FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const tiers = db.prepare(`
    SELECT * FROM pricing_tiers WHERE api_id = ? ORDER BY sort_order ASC, price ASC
  `).all(api.id);

  res.json({
    success: true,
    api: api.name,
    tiers: tiers.map(t => ({
      ...t,
      features: JSON.parse(t.features),
      isPopular: !!t.is_popular,
      requestsLimit: t.requests_limit === -1 ? 'unlimited' : t.requests_limit,
    })),
  });
});

// Update tier
router.put('/:slug/:tierId', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const allowed = ['name', 'price', 'billing_period', 'requests_limit', 'rate_limit', 'features', 'is_popular', 'sort_order'];
  const updates = {};
  Object.keys(req.body).forEach(k => {
    const dbKey = k.replace(/[A-Z]/g, l => '_' + l.toLowerCase());
    if (allowed.includes(dbKey)) updates[dbKey] = k === 'features' ? JSON.stringify(req.body[k]) : req.body[k];
  });

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE pricing_tiers SET ${sets} WHERE id = @id AND api_id = @api_id`)
    .run({ ...updates, id: req.params.tierId, api_id: api.id });

  res.json({ success: true, message: 'Tier updated' });
});

// Delete tier
router.delete('/:slug/:tierId', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  db.prepare('DELETE FROM pricing_tiers WHERE id = ? AND api_id = ?').run(req.params.tierId, api.id);
  res.json({ success: true, message: 'Tier deleted' });
});

export default router;
