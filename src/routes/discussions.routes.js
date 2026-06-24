/**
 * Discussion/Comments Routes for APIs
 * POST /api/v1/discussions/:slug          - New discussion
 * GET  /api/v1/discussions/:slug          - List discussions
 * POST /api/v1/discussions/:slug/:id/reply - Reply to discussion
 */

import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure discussions tables
db.exec(`
  CREATE TABLE IF NOT EXISTS discussions (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'question',
    is_resolved INTEGER DEFAULT 0,
    upvotes INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS discussion_replies (
    id TEXT PRIMARY KEY,
    discussion_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_accepted INTEGER DEFAULT 0,
    upvotes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (discussion_id) REFERENCES discussions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create discussion
router.post('/:slug', requireAuth, (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { title, content, type } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO discussions (id, api_id, user_id, title, content, type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, api.id, req.user.userId, title, content, type || 'question');

  res.status(201).json({ success: true, discussion: { id, title, content, type } });
});

// List discussions for an API
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { page = 1, sort = 'newest' } = req.query;
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;

  const sortMap = { newest: 'created_at DESC', popular: 'upvotes DESC', unanswered: 'reply_count ASC' };
  const orderBy = sortMap[sort] || sortMap.newest;

  const discussions = db.prepare(`
    SELECT d.*, u.username as author
    FROM discussions d
    JOIN users u ON d.user_id = u.id
    WHERE d.api_id = ?
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(api.id, limit, offset);

  res.json({ success: true, discussions, page: parseInt(page) });
});

// Reply to discussion
router.post('/:slug/:discussionId/reply', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const discussion = db.prepare('SELECT id FROM discussions WHERE id = ?')
    .get(req.params.discussionId);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO discussion_replies (id, discussion_id, user_id, content)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.discussionId, req.user.userId, content);

  // Update reply count
  db.prepare('UPDATE discussions SET reply_count = reply_count + 1 WHERE id = ?')
    .run(req.params.discussionId);

  res.status(201).json({ success: true, reply: { id, content } });
});

export default router;
