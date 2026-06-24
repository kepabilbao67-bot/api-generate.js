/**
 * API Versioning Routes
 * POST /api/v1/apis/:slug/versions       - Create new version
 * GET  /api/v1/apis/:slug/versions       - List versions
 * PUT  /api/v1/apis/:slug/versions/:v/activate - Activate version
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure versions table
db.exec(`
  CREATE TABLE IF NOT EXISTS api_versions (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    version TEXT NOT NULL,
    schema_definition TEXT NOT NULL,
    generated_code TEXT,
    changelog TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

// Create new version
router.post('/:slug/versions', requireAuth, (req, res) => {
  const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { version, schema, changelog } = req.body;
  if (!version) return res.status(400).json({ error: 'Version string is required (e.g. 2.0.0)' });

  // Save current as a version snapshot
  const id = uuidv4();
  db.prepare(`
    INSERT INTO api_versions (id, api_id, version, schema_definition, generated_code, changelog)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, api.id, version, schema ? JSON.stringify(schema) : api.schema_definition, api.generated_code, changelog || '');

  // Update main API version
  db.prepare("UPDATE apis SET version = ?, updated_at = datetime('now') WHERE id = ?")
    .run(version, api.id);

  res.status(201).json({
    success: true,
    version: { id, version, changelog, createdAt: new Date().toISOString() },
  });
});

// List versions
router.get('/:slug/versions', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const versions = db.prepare(`
    SELECT id, version, changelog, is_active, created_at
    FROM api_versions WHERE api_id = ?
    ORDER BY created_at DESC
  `).all(api.id);

  res.json({ success: true, versions, currentVersion: req.params.slug });
});

// Activate a specific version (rollback)
router.put('/:slug/versions/:versionId/activate', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const version = db.prepare('SELECT * FROM api_versions WHERE id = ? AND api_id = ?')
    .get(req.params.versionId, api.id);
  if (!version) return res.status(404).json({ error: 'Version not found' });

  // Deactivate all, activate this one
  db.prepare('UPDATE api_versions SET is_active = 0 WHERE api_id = ?').run(api.id);
  db.prepare('UPDATE api_versions SET is_active = 1 WHERE id = ?').run(version.id);

  // Update main API
  db.prepare(`
    UPDATE apis SET version = ?, schema_definition = ?, generated_code = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(version.version, version.schema_definition, version.generated_code, api.id);

  res.json({ success: true, message: `Rolled back to version ${version.version}` });
});

export default router;
