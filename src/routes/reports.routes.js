/**
 * Abuse Reports & Content Moderation
 * POST /api/v1/reports              - Report an API
 * GET  /api/v1/reports              - List reports (admin)
 * PUT  /api/v1/reports/:id/resolve  - Resolve report (admin)
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS abuse_reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    resolution TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Report an API
router.post('/', requireAuth, (req, res) => {
  const { apiSlug, reason, description } = req.body;
  if (!apiSlug || !reason) {
    return res.status(400).json({
      error: 'apiSlug and reason required',
      reasons: ['spam', 'malware', 'copyright', 'inappropriate', 'scam', 'broken', 'other'],
    });
  }

  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(apiSlug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO abuse_reports (id, reporter_id, api_id, reason, description)
    VALUES (?,?,?,?,?)
  `).run(id, req.user.userId, api.id, reason, description || '');

  res.status(201).json({
    success: true,
    report: { id, reason, status: 'pending' },
    message: 'Report submitted. Our team will review within 24 hours.',
  });
});

// List reports (admin only)
router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(req.user.userId);
  if (user?.plan !== 'enterprise') return res.status(403).json({ error: 'Admin access required' });

  const { status } = req.query;
  let where = '1=1';
  const params = [];
  if (status) { where += ' AND r.status = ?'; params.push(status); }

  const reports = db.prepare(`
    SELECT r.*, a.name as api_name, a.slug as api_slug,
           u.username as reporter, u2.username as api_owner
    FROM abuse_reports r
    JOIN apis a ON r.api_id = a.id
    JOIN users u ON r.reporter_id = u.id
    JOIN users u2 ON a.owner_id = u2.id
    WHERE ${where}
    ORDER BY r.created_at DESC LIMIT 50
  `).all(...params);

  res.json({ success: true, reports, count: reports.length });
});

// Resolve report
router.put('/:id/resolve', requireAuth, (req, res) => {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(req.user.userId);
  if (user?.plan !== 'enterprise') return res.status(403).json({ error: 'Admin access required' });

  const { action, resolution } = req.body;
  if (!action) return res.status(400).json({ error: 'action required', actions: ['dismiss', 'warn', 'suspend', 'remove'] });

  db.prepare(`
    UPDATE abuse_reports SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(`${action}: ${resolution || ''}`, req.user.userId, req.params.id);

  // Take action on the API if needed
  if (action === 'suspend' || action === 'remove') {
    const report = db.prepare('SELECT api_id FROM abuse_reports WHERE id = ?').get(req.params.id);
    if (report) {
      const newStatus = action === 'remove' ? 'removed' : 'suspended';
      db.prepare("UPDATE apis SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newStatus, report.api_id);
    }
  }

  res.json({ success: true, message: `Report resolved with action: ${action}` });
});

export default router;
