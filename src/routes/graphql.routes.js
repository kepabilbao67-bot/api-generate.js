/**
 * GraphQL-style Query Endpoint
 * Allows querying generated APIs with GraphQL-like syntax
 * POST /api/v1/query/:slug
 * 
 * Example:
 * { "query": "tasks", "filter": { "status": "doing" }, "fields": ["title", "priority"], "limit": 5 }
 */

import { Router } from 'express';
import { requireApiKey, apiRateLimit } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import db from '../utils/database.js';

const router = Router();

router.post('/:slug', requireApiKey, apiRateLimit, (req, res) => {
  try {
    const { slug } = req.params;
    const { query, filter, fields, sort, limit, page, include } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'query field is required',
        example: {
          query: 'tasks',
          filter: { status: 'doing' },
          fields: ['title', 'priority', 'dueDate'],
          sort: 'priority:desc',
          limit: 10,
          page: 1,
        },
      });
    }

    // Build query params for the engine
    const queryParams = {
      filter: filter ? JSON.stringify(filter) : undefined,
      sort,
      limit: limit || 20,
      page: page || 1,
    };

    // Execute via the engine
    const result = apiEngine.executeRequest(slug, 'GET', `/${query}`, null, queryParams);

    // Field selection (like GraphQL)
    if (fields && Array.isArray(fields) && result.data) {
      const selectFields = (item) => {
        const selected = {};
        fields.forEach(f => {
          if (item[f] !== undefined) selected[f] = item[f];
        });
        return selected;
      };

      if (Array.isArray(result.data)) {
        result.data = result.data.map(selectFields);
      } else {
        result.data = selectFields(result.data);
      }
    }

    res.json({
      success: true,
      ...result,
      _query: { resource: query, filter, fields, sort, limit, page },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
