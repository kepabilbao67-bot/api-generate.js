/**
 * Favorites / Bookmarks Routes
 * POST /api/v1/favorites/:slug    - Add to favorites
 * GET  /api/v1/favorites          - List my favorites
 * DELETE /api/v1/favorites/:slug  - Remove from favorites
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    UNIQUE(user_id, api_id)
  );
`);

// Add to favorites
router.post('/:slug', requireAuth, (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  try {
    db.prepare('INSERT INTO favorites (id, user_id, api_id) VALUES (?,?,?)')
      .run(uuidv4(), req.user.userId, api.id);
    res.status(201).json({ success: true, message: 'Added to favorites' });
  } catch (e) {
    res.status(400).json({ error: 'Already in favorites' });
  }
});

// List favorites
router.get('/', requireAuth, (req, res) => {
  const favs = db.prepare(`
    SELECT a.name, a.slug, a.description, a.category, a.endpoints_count,
           a.total_requests, a.avg_latency, f.created_at as favorited_at
    FROM favorites f
    JOIN apis a ON f.api_id = a.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.userId);
  res.json({ success: true, favorites: favs, count: favs.length });
});

// Remove from favorites
router.delete('/:slug', requireAuth, (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND api_id = ?')
    .run(req.user.userId, api.id);
  res.json({ success: true });
});

export default router;
