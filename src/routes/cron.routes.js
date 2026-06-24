/**
 * Scheduled Tasks / Cron Routes
 * POST /api/v1/cron                - Create scheduled task
 * GET  /api/v1/cron                - List my scheduled tasks
 * DELETE /api/v1/cron/:id          - Delete task
 * 
 * Allows users to schedule periodic API calls (e.g., cleanup, reports)
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    api_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    method TEXT DEFAULT 'GET',
    path TEXT NOT NULL,
    body TEXT,
    schedule TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_run TEXT,
    next_run TEXT,
    run_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create cron job
router.post('/', requireAuth, (req, res) => {
  const { apiSlug, name, method, path, body, schedule } = req.body;
  if (!apiSlug || !name || !path || !schedule) {
    return res.status(400).json({
      error: 'apiSlug, name, path, and schedule required',
      scheduleOptions: ['every_1m', 'every_5m', 'every_15m', 'every_1h', 'every_6h', 'every_24h', 'weekly'],
    });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO cron_jobs (id, user_id, api_slug, name, method, path, body, schedule)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(id, req.user.userId, apiSlug, name, method || 'GET', path, body ? JSON.stringify(body) : null, schedule);
  res.status(201).json({ success: true, cronJob: { id, name, schedule, path } });
});

// List cron jobs
router.get('/', requireAuth, (req, res) => {
  const jobs = db.prepare('SELECT * FROM cron_jobs WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.userId);
  res.json({ success: true, jobs });
});

// Delete cron job
router.delete('/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM cron_jobs WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true });
});

export default router;
