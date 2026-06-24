/**
 * Support Tickets per API
 * POST /api/v1/support/:slug           - Create ticket
 * GET  /api/v1/support/:slug           - List tickets (owner)
 * GET  /api/v1/support/my              - My submitted tickets
 * POST /api/v1/support/:slug/:id/reply - Reply to ticket
 * PUT  /api/v1/support/:slug/:id/close - Close ticket
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_owner_reply INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create ticket
router.post('/:slug', requireAuth, (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { subject, description, priority } = req.body;
  if (!subject || !description) return res.status(400).json({ error: 'subject and description required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO support_tickets (id, api_id, user_id, subject, description, priority)
    VALUES (?,?,?,?,?,?)
  `).run(id, api.id, req.user.userId, subject, description, priority || 'medium');

  res.status(201).json({ success: true, ticket: { id, subject, status: 'open', priority: priority || 'medium' } });
});

// List tickets for API (owner view)
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found or not owned' });

  const { status } = req.query;
  let where = 'WHERE t.api_id = ?';
  const params = [api.id];
  if (status) { where += ' AND t.status = ?'; params.push(status); }

  const tickets = db.prepare(`
    SELECT t.*, u.username as submitter,
           (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) as reply_count
    FROM support_tickets t
    JOIN users u ON t.user_id = u.id
    ${where}
    ORDER BY t.updated_at DESC
  `).all(...params);

  res.json({ success: true, tickets, count: tickets.length });
});

// My submitted tickets
router.get('/my', requireAuth, (req, res) => {
  const tickets = db.prepare(`
    SELECT t.*, a.name as api_name, a.slug as api_slug
    FROM support_tickets t
    JOIN apis a ON t.api_id = a.id
    WHERE t.user_id = ?
    ORDER BY t.updated_at DESC
  `).all(req.user.userId);

  res.json({ success: true, tickets });
});

// Reply to ticket
router.post('/:slug/:ticketId/reply', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?')
    .get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Check if user is owner or ticket creator
  const api = db.prepare('SELECT owner_id FROM apis WHERE id = ?').get(ticket.api_id);
  const isOwner = api?.owner_id === req.user.userId;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO ticket_replies (id, ticket_id, user_id, content, is_owner_reply)
    VALUES (?,?,?,?,?)
  `).run(id, req.params.ticketId, req.user.userId, content, isOwner ? 1 : 0);

  db.prepare("UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?")
    .run(req.params.ticketId);

  res.status(201).json({ success: true, reply: { id, content, isOwnerReply: isOwner } });
});

// Close ticket
router.put('/:slug/:ticketId/close', requireAuth, (req, res) => {
  db.prepare("UPDATE support_tickets SET status = 'closed', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.ticketId);
  res.json({ success: true, message: 'Ticket closed' });
});

export default router;
