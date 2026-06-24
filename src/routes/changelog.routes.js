/**
 * Public Changelog Routes
 * GET /api/v1/changelog/:slug  - Public API changelog
 * POST /api/v1/changelog/:slug - Add changelog entry
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure changelog table
db.exec(`
  CREATE TABLE IF NOT EXISTS changelog_entries (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'improvement',
    breaking INTEGER DEFAULT 0,
    published_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Get public changelog
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id, name FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const entries = db.prepare(`
    SELECT * FROM changelog_entries
    WHERE api_id = ?
    ORDER BY published_at DESC
    LIMIT 50
  `).all(api.id);

  res.json({
    success: true,
    api: api.name,
    changelog: entries.map(e => ({
      ...e,
      breaking: !!e.breaking,
    })),
  });
});

// Add changelog entry (owner only)
router.post('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found or not owned' });

  const { version, title, description, type, breaking } = req.body;
  if (!version || !title) {
    return res.status(400).json({ error: 'version and title are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO changelog_entries (id, api_id, version, title, description, type, breaking)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, api.id, version, title, description || '', type || 'improvement', breaking ? 1 : 0);

  res.status(201).json({
    success: true,
    entry: { id, version, title, description, type, breaking: !!breaking },
  });
});

export default router;
