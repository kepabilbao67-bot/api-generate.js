/**
 * Backup & Restore Routes
 * POST /api/v1/backup/:slug          - Create backup
 * GET  /api/v1/backup/:slug          - List backups
 * POST /api/v1/backup/:slug/restore/:id - Restore from backup
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    schema_snapshot TEXT NOT NULL,
    item_count INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create backup
router.post('/:slug', requireAuth, (req, res) => {
  try {
    const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
      .get(req.params.slug, req.user.userId);
    if (!api) return res.status(404).json({ error: 'API not found' });

    const schema = JSON.parse(api.schema_definition);
    const allData = {};
    let totalItems = 0;

    schema.resources.forEach(resource => {
      const name = resource.name.toLowerCase();
      const plural = name.endsWith('s') ? name : `${name}s`;
      try {
        const result = apiEngine.executeRequest(api.slug, 'GET', `/${plural}`, null, { limit: 50000 });
        allData[plural] = result.data || [];
        totalItems += allData[plural].length;
      } catch { allData[plural] = []; }
    });

    const dataStr = JSON.stringify(allData);
    const id = uuidv4();

    db.prepare(`
      INSERT INTO backups (id, api_id, user_id, data, schema_snapshot, item_count, size_bytes, note)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, api.id, req.user.userId, dataStr, api.schema_definition, totalItems, dataStr.length, req.body.note || '');

    res.status(201).json({
      success: true,
      backup: {
        id,
        itemCount: totalItems,
        sizeBytes: dataStr.length,
        sizeHuman: formatBytes(dataStr.length),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List backups
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const backups = db.prepare(`
    SELECT id, item_count, size_bytes, note, created_at
    FROM backups WHERE api_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(api.id, req.user.userId);

  res.json({
    success: true,
    backups: backups.map(b => ({ ...b, sizeHuman: formatBytes(b.size_bytes) })),
  });
});

// Restore from backup
router.post('/:slug/restore/:backupId', requireAuth, (req, res) => {
  try {
    const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
      .get(req.params.slug, req.user.userId);
    if (!api) return res.status(404).json({ error: 'API not found' });

    const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND user_id = ?')
      .get(req.params.backupId, req.user.userId);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    const data = JSON.parse(backup.data);
    let restored = 0;

    // Clear existing data and restore
    Object.entries(data).forEach(([resource, items]) => {
      // Clear current data for this resource
      const storageKey = `api_data_${resource.endsWith('s') ? resource.slice(0, -1) : resource}`;
      apiEngine.setStorage(storageKey, []);
      
      // Restore items
      items.forEach(item => {
        try {
          apiEngine.executeRequest(api.slug, 'POST', `/${resource}`, item, {});
          restored++;
        } catch { /* skip duplicates */ }
      });
    });

    res.json({
      success: true,
      message: `Restored ${restored} items from backup`,
      backupDate: backup.created_at,
      itemsRestored: restored,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default router;
