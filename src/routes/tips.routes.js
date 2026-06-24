/**
 * Tips / Donations System
 * Let consumers tip API creators they appreciate
 * 
 * POST /api/v1/tips/:slug         - Send tip to API creator
 * GET  /api/v1/tips/received      - Tips I've received
 * GET  /api/v1/tips/sent          - Tips I've sent
 * GET  /api/v1/tips/:slug/top     - Top tippers for an API
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS tips (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    amount REAL NOT NULL,
    message TEXT,
    is_anonymous INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Send a tip
router.post('/:slug', requireAuth, (req, res) => {
  const { amount, message, anonymous } = req.body;
  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'Minimum tip is $1', amounts: [1, 5, 10, 25, 50] });
  }
  if (amount > 500) return res.status(400).json({ error: 'Maximum tip is $500' });

  const api = db.prepare(`
    SELECT a.id, a.owner_id, a.name, u.username as creator
    FROM apis a JOIN users u ON a.owner_id = u.id
    WHERE a.slug = ?
  `).get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });
  if (api.owner_id === req.user.userId) return res.status(400).json({ error: "Can't tip yourself" });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tips (id, from_user_id, to_user_id, api_id, amount, message, is_anonymous)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, req.user.userId, api.owner_id, api.id, amount, message || '', anonymous ? 1 : 0);

  res.status(201).json({
    success: true,
    tip: { id, amount, to: api.creator, api: api.name, message: message || null },
    message: `$${amount} tip sent to ${api.creator}!`,
  });
});

// Tips received (as creator)
router.get('/received', requireAuth, (req, res) => {
  const tips = db.prepare(`
    SELECT t.amount, t.message, t.is_anonymous, t.created_at,
           u.username as from_user, a.name as api_name, a.slug
    FROM tips t
    JOIN users u ON t.from_user_id = u.id
    JOIN apis a ON t.api_id = a.id
    WHERE t.to_user_id = ?
    ORDER BY t.created_at DESC LIMIT 50
  `).all(req.user.userId);

  const total = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM tips WHERE to_user_id = ?')
    .get(req.user.userId);

  res.json({
    success: true,
    tips: tips.map(t => ({
      ...t,
      from_user: t.is_anonymous ? 'Anonymous' : t.from_user,
    })),
    totalReceived: total.t,
  });
});

// Tips sent
router.get('/sent', requireAuth, (req, res) => {
  const tips = db.prepare(`
    SELECT t.amount, t.message, t.created_at,
           u.username as to_user, a.name as api_name
    FROM tips t
    JOIN users u ON t.to_user_id = u.id
    JOIN apis a ON t.api_id = a.id
    WHERE t.from_user_id = ?
    ORDER BY t.created_at DESC
  `).all(req.user.userId);

  const total = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM tips WHERE from_user_id = ?')
    .get(req.user.userId);

  res.json({ success: true, tips, totalSent: total.t });
});

// Top tippers for an API
router.get('/:slug/top', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const topTippers = db.prepare(`
    SELECT u.username, SUM(t.amount) as total_tipped, COUNT(*) as tip_count
    FROM tips t JOIN users u ON t.from_user_id = u.id
    WHERE t.api_id = ? AND t.is_anonymous = 0
    GROUP BY t.from_user_id
    ORDER BY total_tipped DESC LIMIT 10
  `).all(api.id);

  res.json({ success: true, topTippers });
});

export default router;
