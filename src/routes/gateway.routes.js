/**
 * API Gateway Features
 * Request/Response transformation, header injection, URL rewriting
 * 
 * POST /api/v1/gateway/:slug/rules    - Add transformation rule
 * GET  /api/v1/gateway/:slug/rules    - List rules
 * DELETE /api/v1/gateway/:slug/:id    - Delete rule
 * GET  /api/v1/gateway/:slug/test     - Test rules with dry-run
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS gateway_rules (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

const RULE_TYPES = {
  'add-header': { description: 'Add custom header to all responses', configSchema: { header: 'string', value: 'string' } },
  'remove-header': { description: 'Remove header from responses', configSchema: { header: 'string' } },
  'rename-field': { description: 'Rename a field in JSON responses', configSchema: { from: 'string', to: 'string' } },
  'add-field': { description: 'Add computed field to responses', configSchema: { field: 'string', value: 'string' } },
  'remove-field': { description: 'Strip field from responses', configSchema: { field: 'string' } },
  'set-content-type': { description: 'Override Content-Type header', configSchema: { contentType: 'string' } },
  'add-cors-origin': { description: 'Add specific CORS origin', configSchema: { origin: 'string' } },
  'rate-limit-override': { description: 'Custom rate limit for specific endpoints', configSchema: { path: 'string', limit: 'number', window: 'number' } },
  'redirect': { description: 'Redirect specific paths', configSchema: { from: 'string', to: 'string', code: 'number' } },
  'mock-response': { description: 'Return mock response for specific path', configSchema: { path: 'string', method: 'string', status: 'number', body: 'object' } },
};

// Add rule
router.post('/:slug/rules', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { name, type, config, priority } = req.body;
  if (!name || !type || !config) {
    return res.status(400).json({
      error: 'name, type, and config required',
      availableTypes: Object.entries(RULE_TYPES).map(([id, def]) => ({ id, ...def })),
    });
  }

  if (!RULE_TYPES[type]) return res.status(400).json({ error: `Unknown rule type: ${type}` });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO gateway_rules (id, api_id, name, type, config, priority)
    VALUES (?,?,?,?,?,?)
  `).run(id, api.id, name, type, JSON.stringify(config), priority || 0);

  res.status(201).json({ success: true, rule: { id, name, type, config } });
});

// List rules
router.get('/:slug/rules', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const rules = db.prepare('SELECT * FROM gateway_rules WHERE api_id = ? ORDER BY priority ASC')
    .all(api.id).map(r => ({ ...r, config: JSON.parse(r.config) }));

  res.json({ success: true, rules, availableTypes: Object.keys(RULE_TYPES) });
});

// Delete rule
router.delete('/:slug/:ruleId', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  db.prepare('DELETE FROM gateway_rules WHERE id = ? AND api_id = ?').run(req.params.ruleId, api.id);
  res.json({ success: true, message: 'Rule deleted' });
});

// Dry-run test
router.get('/:slug/test', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const rules = db.prepare('SELECT * FROM gateway_rules WHERE api_id = ? AND is_active = 1 ORDER BY priority')
    .all(api.id);

  res.json({
    success: true,
    dryRun: {
      activeRules: rules.length,
      pipeline: rules.map(r => ({ name: r.name, type: r.type, priority: r.priority })),
      example: 'Requests to this API will pass through these transformations in order',
    },
  });
});

export default router;
