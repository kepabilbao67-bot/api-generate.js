/**
 * API Relationships - Link APIs together
 * POST /api/v1/relationships          - Create relationship
 * GET  /api/v1/relationships/:slug    - Get API relationships
 * DELETE /api/v1/relationships/:id    - Remove relationship
 * 
 * Allows creating linked APIs (e.g., Users API -> Orders API)
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS api_relationships (
    id TEXT PRIMARY KEY,
    source_api_id TEXT NOT NULL,
    target_api_id TEXT NOT NULL,
    relationship_type TEXT DEFAULT 'depends_on',
    description TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_api_id) REFERENCES apis(id),
    FOREIGN KEY (target_api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create relationship between two APIs
router.post('/', requireAuth, (req, res) => {
  const { sourceSlug, targetSlug, type, description } = req.body;
  if (!sourceSlug || !targetSlug) {
    return res.status(400).json({
      error: 'sourceSlug and targetSlug required',
      types: ['depends_on', 'extends', 'consumes', 'feeds_into', 'alternative_to'],
    });
  }

  const source = db.prepare("SELECT id, name FROM apis WHERE slug = ?").get(sourceSlug);
  const target = db.prepare("SELECT id, name FROM apis WHERE slug = ?").get(targetSlug);
  if (!source || !target) return res.status(404).json({ error: 'One or both APIs not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO api_relationships (id, source_api_id, target_api_id, relationship_type, description, user_id)
    VALUES (?,?,?,?,?,?)
  `).run(id, source.id, target.id, type || 'depends_on', description || '', req.user.userId);

  res.status(201).json({
    success: true,
    relationship: { id, source: sourceSlug, target: targetSlug, type: type || 'depends_on' },
  });
});

// Get relationships for an API
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const outgoing = db.prepare(`
    SELECT r.id, r.relationship_type, r.description, a.name, a.slug
    FROM api_relationships r
    JOIN apis a ON r.target_api_id = a.id
    WHERE r.source_api_id = ?
  `).all(api.id);

  const incoming = db.prepare(`
    SELECT r.id, r.relationship_type, r.description, a.name, a.slug
    FROM api_relationships r
    JOIN apis a ON r.source_api_id = a.id
    WHERE r.target_api_id = ?
  `).all(api.id);

  res.json({
    success: true,
    relationships: {
      dependsOn: outgoing.map(r => ({ ...r, direction: 'outgoing' })),
      usedBy: incoming.map(r => ({ ...r, direction: 'incoming' })),
    },
    total: outgoing.length + incoming.length,
  });
});

// Delete relationship
router.delete('/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM api_relationships WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Relationship not found' });
  res.json({ success: true });
});

export default router;
