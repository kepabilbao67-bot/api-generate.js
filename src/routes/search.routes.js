/**
 * Global Search Routes
 * GET /api/v1/search?q=keyword   - Search across all marketplace APIs
 * GET /api/v1/search/suggest     - Auto-complete suggestions
 */

import { Router } from 'express';
import db from '../utils/database.js';

const router = Router();

// Full-text search across APIs
router.get('/', (req, res) => {
  const { q, category, pricing, sort, page = 1, limit = 20 } = req.query;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query (q) must be at least 2 characters' });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const searchTerm = `%${q}%`;

  let where = "WHERE a.status = 'active' AND a.visibility = 'public' AND (a.name LIKE ? OR a.description LIKE ? OR a.tags LIKE ?)";
  const params = [searchTerm, searchTerm, searchTerm];

  if (category) {
    where += ' AND a.category = ?';
    params.push(category);
  }
  if (pricing) {
    where += ' AND a.pricing_model = ?';
    params.push(pricing);
  }

  const sortMap = {
    relevance: 'a.total_requests DESC',
    newest: 'a.created_at DESC',
    popular: 'a.total_requests DESC',
    name: 'a.name ASC',
  };
  const orderBy = sortMap[sort] || sortMap.relevance;

  const total = db.prepare(`SELECT COUNT(*) as c FROM apis a ${where}`).get(...params);

  const results = db.prepare(`
    SELECT a.name, a.slug, a.description, a.category, a.pricing_model,
           a.endpoints_count, a.total_requests, a.avg_latency, a.tags,
           u.username as creator
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    success: true,
    query: q,
    results: results.map(r => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : [],
      highlight: highlightMatch(r.name + ' ' + (r.description || ''), q),
    })),
    meta: { total: total.c, page: parseInt(page), limit: parseInt(limit) },
  });
});

// Auto-suggest
router.get('/suggest', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json({ suggestions: [] });

  const apis = db.prepare(`
    SELECT DISTINCT name FROM apis
    WHERE status = 'active' AND visibility = 'public' AND name LIKE ?
    LIMIT 10
  `).all(`%${q}%`);

  const tags = db.prepare(`
    SELECT DISTINCT tags FROM apis
    WHERE status = 'active' AND tags LIKE ?
    LIMIT 5
  `).all(`%${q}%`);

  const suggestions = [
    ...apis.map(a => ({ type: 'api', value: a.name })),
    ...tags.flatMap(t => {
      try {
        return JSON.parse(t.tags).filter(tag => tag.includes(q)).map(tag => ({ type: 'tag', value: tag }));
      } catch { return []; }
    }),
  ].slice(0, 10);

  res.json({ success: true, suggestions });
});

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 100);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + query.length + 30);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

export default router;
