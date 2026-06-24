/**
 * API Newsletter - Notify subscribers of updates
 * POST /api/v1/newsletter/:slug/subscribe   - Subscribe to updates
 * POST /api/v1/newsletter/:slug/send        - Send update (owner)
 * GET  /api/v1/newsletter/:slug/subscribers - List subscribers
 * DELETE /api/v1/newsletter/:slug/unsubscribe - Unsubscribe
 */

import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    subscribed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    UNIQUE(api_id, email)
  );

  CREATE TABLE IF NOT EXISTS newsletter_messages (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Subscribe to API updates
router.post('/:slug/subscribe', optionalAuth, (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const email = req.body.email || (req.user ? db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.userId)?.email : null);
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    db.prepare('INSERT INTO newsletter_subscribers (id, api_id, user_id, email) VALUES (?,?,?,?)')
      .run(uuidv4(), api.id, req.user?.userId || null, email);
    res.status(201).json({ success: true, message: `Subscribed ${email} to updates` });
  } catch (e) {
    res.status(400).json({ error: 'Already subscribed' });
  }
});

// Send newsletter (owner only)
router.post('/:slug/send', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id, name FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found or not owned' });

  const { subject, content } = req.body;
  if (!subject || !content) return res.status(400).json({ error: 'subject and content required' });

  const subscribers = db.prepare('SELECT email FROM newsletter_subscribers WHERE api_id = ?').all(api.id);

  const id = uuidv4();
  db.prepare(`
    INSERT INTO newsletter_messages (id, api_id, subject, content, recipients_count)
    VALUES (?,?,?,?,?)
  `).run(id, api.id, subject, content, subscribers.length);

  // In production: actually send emails here
  res.json({
    success: true,
    message: `Newsletter sent to ${subscribers.length} subscribers`,
    newsletter: { id, subject, recipientCount: subscribers.length },
  });
});

// List subscribers (owner)
router.get('/:slug/subscribers', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const subscribers = db.prepare('SELECT email, subscribed_at FROM newsletter_subscribers WHERE api_id = ?').all(api.id);
  res.json({ success: true, subscribers, count: subscribers.length });
});

// Unsubscribe
router.delete('/:slug/unsubscribe', optionalAuth, (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const email = req.body.email || (req.user ? db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.userId)?.email : null);
  if (!email) return res.status(400).json({ error: 'Email required' });

  db.prepare('DELETE FROM newsletter_subscribers WHERE api_id = ? AND email = ?').run(api.id, email);
  res.json({ success: true, message: 'Unsubscribed' });
});

export default router;
