/**
 * API Branding - Custom look & feel per API
 * POST /api/v1/branding/:slug    - Set branding
 * GET  /api/v1/branding/:slug    - Get branding
 * 
 * Allows creators to customize their API's appearance
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS api_branding (
    api_id TEXT PRIMARY KEY,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#6366f1',
    accent_color TEXT DEFAULT '#0ea5e9',
    custom_domain TEXT,
    footer_text TEXT,
    support_email TEXT,
    support_url TEXT,
    social_twitter TEXT,
    social_github TEXT,
    custom_css TEXT,
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Set branding
router.post('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const fields = ['logo_url', 'primary_color', 'accent_color', 'custom_domain',
    'footer_text', 'support_email', 'support_url', 'social_twitter', 'social_github', 'custom_css'];

  const values = {};
  fields.forEach(f => {
    if (req.body[f] !== undefined) values[f] = req.body[f];
  });

  const existing = db.prepare('SELECT api_id FROM api_branding WHERE api_id = ?').get(api.id);

  if (existing) {
    const sets = Object.keys(values).map(k => `${k} = @${k}`).join(', ');
    if (sets) {
      db.prepare(`UPDATE api_branding SET ${sets} WHERE api_id = @api_id`).run({ ...values, api_id: api.id });
    }
  } else {
    db.prepare(`INSERT INTO api_branding (api_id, ${Object.keys(values).join(',')}) VALUES (@api_id, ${Object.keys(values).map(k => '@' + k).join(',')})`)
      .run({ api_id: api.id, ...values });
  }

  res.json({ success: true, message: 'Branding updated', branding: values });
});

// Get branding
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id, name FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const branding = db.prepare('SELECT * FROM api_branding WHERE api_id = ?').get(api.id);

  res.json({
    success: true,
    branding: branding || {
      logo_url: null,
      primary_color: '#6366f1',
      accent_color: '#0ea5e9',
      footer_text: `Powered by APIForge`,
    },
  });
});

export default router;
