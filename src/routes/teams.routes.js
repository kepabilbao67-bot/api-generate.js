/**
 * Team Management Routes
 * POST /api/v1/teams                - Create team
 * GET  /api/v1/teams                - List my teams
 * POST /api/v1/teams/:id/invite     - Invite member
 * POST /api/v1/teams/:id/apis       - Share API with team
 * DELETE /api/v1/teams/:id/members/:uid - Remove member
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(team_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS team_apis (
    team_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    PRIMARY KEY (team_id, api_id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO teams (id, name, owner_id) VALUES (?,?,?)').run(id, name, req.user.userId);
  db.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?,?,?,?)').run(uuidv4(), id, req.user.userId, 'owner');
  res.status(201).json({ success: true, team: { id, name } });
});

router.get('/', requireAuth, (req, res) => {
  const teams = db.prepare(`
    SELECT t.*, tm.role FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `).all(req.user.userId);
  res.json({ success: true, teams });
});

router.post('/:id/invite', requireAuth, (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    db.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?,?,?,?)').run(uuidv4(), req.params.id, user.id, 'member');
    res.json({ success: true, message: `${email} invited` });
  } catch (e) { res.status(400).json({ error: 'Already a member' }); }
});

router.post('/:id/apis', requireAuth, (req, res) => {
  const { apiId } = req.body;
  try {
    db.prepare('INSERT INTO team_apis (team_id, api_id) VALUES (?,?)').run(req.params.id, apiId);
    res.json({ success: true, message: 'API shared with team' });
  } catch (e) { res.status(400).json({ error: 'Already shared' }); }
});

router.delete('/:id/members/:uid', requireAuth, (req, res) => {
  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(req.params.id, req.params.uid);
  res.json({ success: true });
});

export default router;
