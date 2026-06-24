/**
 * API Deprecation Workflow
 * Sunset APIs gracefully with advance notice
 * 
 * POST /api/v1/deprecation/:slug/schedule  - Schedule deprecation
 * GET  /api/v1/deprecation/:slug           - Get deprecation info
 * POST /api/v1/deprecation/:slug/cancel    - Cancel deprecation
 * GET  /api/v1/deprecation/upcoming        - List upcoming deprecations
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS deprecations (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sunset_date TEXT NOT NULL,
    reason TEXT,
    replacement_slug TEXT,
    migration_guide TEXT,
    notify_subscribers INTEGER DEFAULT 1,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Schedule deprecation
router.post('/:slug/schedule', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id, name FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { sunsetDate, reason, replacementSlug, migrationGuide } = req.body;
  if (!sunsetDate) return res.status(400).json({ error: 'sunsetDate required (ISO format)' });

  // Must be at least 30 days in the future
  const sunset = new Date(sunsetDate);
  const minDate = new Date(Date.now() + 30 * 86400000);
  if (sunset < minDate) {
    return res.status(400).json({ error: 'Sunset date must be at least 30 days from now' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO deprecations (id, api_id, user_id, sunset_date, reason, replacement_slug, migration_guide)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, api.id, req.user.userId, sunsetDate, reason || '', replacementSlug || null, migrationGuide || null);

  res.status(201).json({
    success: true,
    deprecation: {
      id,
      api: api.name,
      sunsetDate,
      daysUntilSunset: Math.ceil((sunset - Date.now()) / 86400000),
      reason,
      replacement: replacementSlug || 'None specified',
    },
    message: 'Deprecation scheduled. Subscribers will be notified.',
    note: 'After sunset date, API will return 410 Gone with migration info.',
  });
});

// Get deprecation info
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const dep = db.prepare(`
    SELECT * FROM deprecations WHERE api_id = ? AND status = 'scheduled'
    ORDER BY created_at DESC LIMIT 1
  `).get(api.id);

  if (!dep) return res.json({ success: true, deprecated: false });

  const sunset = new Date(dep.sunset_date);
  const daysLeft = Math.ceil((sunset - Date.now()) / 86400000);

  res.json({
    success: true,
    deprecated: true,
    info: {
      sunsetDate: dep.sunset_date,
      daysRemaining: Math.max(0, daysLeft),
      reason: dep.reason,
      replacement: dep.replacement_slug ? { slug: dep.replacement_slug, url: `/api/v1/live/${dep.replacement_slug}` } : null,
      migrationGuide: dep.migration_guide,
      status: daysLeft <= 0 ? 'sunset' : 'deprecated',
    },
  });
});

// Cancel deprecation
router.post('/:slug/cancel', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  db.prepare("UPDATE deprecations SET status = 'cancelled' WHERE api_id = ? AND status = 'scheduled'")
    .run(api.id);
  res.json({ success: true, message: 'Deprecation cancelled' });
});

// List upcoming deprecations (public)
router.get('/upcoming', (req, res) => {
  const upcoming = db.prepare(`
    SELECT d.sunset_date, d.reason, d.replacement_slug,
           a.name, a.slug, u.username as owner
    FROM deprecations d
    JOIN apis a ON d.api_id = a.id
    JOIN users u ON d.user_id = u.id
    WHERE d.status = 'scheduled' AND d.sunset_date > datetime('now')
    ORDER BY d.sunset_date ASC
  `).all();

  res.json({ success: true, upcoming, count: upcoming.length });
});

export default router;
