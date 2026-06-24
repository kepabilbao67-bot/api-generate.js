/**
 * Debug & Error Resolution Routes
 * Helps users diagnose and fix API issues automatically
 * 
 * GET  /api/v1/debug/:slug           - Full diagnostic report
 * GET  /api/v1/debug/:slug/errors    - Recent errors with solutions
 * POST /api/v1/debug/:slug/test      - Run automated tests on API
 * GET  /api/v1/debug/:slug/fix       - Auto-fix suggestions
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import apiEngine from '../core/engine.js';

const router = Router();

// Full diagnostic report
router.get('/:slug', requireAuth, (req, res) => {
  const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const schema = JSON.parse(api.schema_definition);

  // Check for common issues
  const issues = [];
  const warnings = [];
  const passed = [];

  // 1. Check if API has any data
  let hasData = false;
  schema.resources?.forEach(r => {
    const name = r.name.toLowerCase();
    const plural = name.endsWith('s') ? name : `${name}s`;
    try {
      const result = apiEngine.executeRequest(api.slug, 'GET', `/${plural}`, null, { limit: 1 });
      if (result.data && result.data.length > 0) hasData = true;
    } catch (e) { /* empty */ }
  });

  if (!hasData) {
    warnings.push({
      code: 'NO_DATA',
      title: 'API has no data',
      message: 'Your API is empty. Create some items to test it properly.',
      fix: `POST /api/v1/live/${api.slug}/${schema.resources[0]?.name?.toLowerCase()}s with a JSON body`,
    });
  } else {
    passed.push('API has data');
  }

  // 2. Check schema quality
  schema.resources?.forEach(r => {
    if (r.fields.length < 2) {
      warnings.push({
        code: 'FEW_FIELDS',
        title: `Resource "${r.name}" has very few fields`,
        message: `Only ${r.fields.length} field(s). Consider adding more for a richer API.`,
        fix: 'Recreate the API with more fields in the schema',
      });
    } else {
      passed.push(`Resource "${r.name}" has ${r.fields.length} fields`);
    }

    if (!r.fields.some(f => f.required)) {
      warnings.push({
        code: 'NO_REQUIRED_FIELDS',
        title: `Resource "${r.name}" has no required fields`,
        message: 'Without required fields, users can create empty items.',
        fix: 'Add "required: true" to important fields like name/title',
      });
    } else {
      passed.push(`Resource "${r.name}" has validation`);
    }
  });

  // 3. Check API status
  if (api.status !== 'active') {
    issues.push({
      code: 'NOT_ACTIVE',
      title: 'API is not active',
      message: `Current status: "${api.status}". Only active APIs can receive requests.`,
      fix: `PUT /api/v1/apis/${api.slug} with { "status": "active" }`,
    });
  } else {
    passed.push('API status is active');
  }

  // 4. Check for recent errors
  const recentErrors = db.prepare(`
    SELECT COUNT(*) as count FROM request_logs
    WHERE api_id = ? AND status_code >= 400 AND created_at > datetime('now', '-24 hours')
  `).get(api.id);

  const totalRequests = db.prepare(`
    SELECT COUNT(*) as count FROM request_logs
    WHERE api_id = ? AND created_at > datetime('now', '-24 hours')
  `).get(api.id);

  if (recentErrors.count > 0 && totalRequests.count > 0) {
    const errorRate = ((recentErrors.count / totalRequests.count) * 100).toFixed(1);
    if (errorRate > 10) {
      issues.push({
        code: 'HIGH_ERROR_RATE',
        title: `High error rate: ${errorRate}%`,
        message: `${recentErrors.count} errors in the last 24 hours out of ${totalRequests.count} requests.`,
        fix: 'Check /api/v1/debug/' + api.slug + '/errors for details',
      });
    }
  }
  passed.push(`${totalRequests.count} requests in 24h (${recentErrors.count} errors)`);

  // 5. Check API key exists
  const keys = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE api_id = ? AND is_active = 1').get(api.id);
  if (keys.count === 0) {
    issues.push({
      code: 'NO_API_KEYS',
      title: 'No active API keys',
      message: 'Without API keys, no one can access your API.',
      fix: 'Create a key: POST /api/v1/keys/' + api.id,
    });
  } else {
    passed.push(`${keys.count} active API key(s)`);
  }

  // 6. Check latency
  if (api.avg_latency > 500) {
    warnings.push({
      code: 'HIGH_LATENCY',
      title: `High average latency: ${api.avg_latency}ms`,
      message: 'APIs with >500ms latency provide a poor user experience.',
      fix: 'Add the "cache" plugin: POST /api/v1/plugins/' + api.slug + ' with { "type": "cache" }',
    });
  } else {
    passed.push(`Latency OK: ${api.avg_latency || 0}ms`);
  }

  const health = issues.length === 0 ? (warnings.length === 0 ? 'healthy' : 'warnings') : 'issues';

  res.json({
    success: true,
    api: api.name,
    slug: api.slug,
    health,
    summary: `${passed.length} passed, ${warnings.length} warnings, ${issues.length} issues`,
    issues,
    warnings,
    passed,
    quickFixes: issues.concat(warnings).map(i => i.fix).filter(Boolean),
  });
});

// Recent errors with explanations and solutions
router.get('/:slug/errors', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id, name FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const errors = db.prepare(`
    SELECT status_code, method, endpoint, COUNT(*) as count,
           MAX(created_at) as last_seen
    FROM request_logs
    WHERE api_id = ? AND status_code >= 400
    GROUP BY status_code, method, endpoint
    ORDER BY count DESC
    LIMIT 20
  `).all(api.id);

  const explained = errors.map(err => ({
    ...err,
    explanation: getErrorExplanation(err.status_code),
    solution: getErrorSolution(err.status_code, err.method, err.endpoint),
  }));

  res.json({ success: true, api: api.name, errors: explained, total: errors.length });
});

// Run automated tests on the API
router.post('/:slug/test', requireAuth, async (req, res) => {
  const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const schema = JSON.parse(api.schema_definition);
  const results = [];

  // Get an API key for testing
  const key = db.prepare('SELECT key_value FROM api_keys WHERE api_id = ? AND is_active = 1 LIMIT 1').get(api.id);
  if (!key) {
    return res.json({ success: true, results: [{ test: 'API Key', passed: false, error: 'No active API key found' }] });
  }

  // Test each resource
  for (const resource of schema.resources || []) {
    const name = resource.name.toLowerCase();
    const plural = name.endsWith('s') ? name : `${name}s`;

    // Test GET (list)
    try {
      const r = apiEngine.executeRequest(api.slug, 'GET', `/${plural}`, null, {});
      results.push({ test: `GET /${plural}`, passed: true, response: `${r.data?.length || 0} items` });
    } catch (e) {
      results.push({ test: `GET /${plural}`, passed: false, error: e.message });
    }

    // Test POST (create)
    const testBody = {};
    resource.fields.forEach(f => {
      if (f.name === 'id') return;
      const defaults = { string: 'test_value', number: 42, integer: 1, boolean: true, email: 'test@test.com', url: 'https://test.com', date: '2026-01-01', array: [], object: {} };
      testBody[f.name] = defaults[f.type] || 'test';
    });

    try {
      const r = apiEngine.executeRequest(api.slug, 'POST', `/${plural}`, testBody, {});
      results.push({ test: `POST /${plural}`, passed: true, response: `Created: ${r.data?.id?.slice(0, 8)}...` });

      // Test GET by ID
      if (r.data?.id) {
        try {
          // Test DELETE
          apiEngine.executeRequest(api.slug, 'DELETE', `/${plural}/${r.data.id}`, null, {});
          results.push({ test: `DELETE /${plural}/:id`, passed: true, response: 'Deleted test item' });
        } catch (e) {
          results.push({ test: `DELETE /${plural}/:id`, passed: false, error: e.message });
        }
      }
    } catch (e) {
      results.push({ test: `POST /${plural}`, passed: false, error: e.message });
    }
  }

  const passedCount = results.filter(r => r.passed).length;
  res.json({
    success: true,
    api: api.name,
    results,
    summary: `${passedCount}/${results.length} tests passed`,
    allPassed: passedCount === results.length,
  });
});

// Auto-fix suggestions based on current state
router.get('/:slug/fix', requireAuth, (req, res) => {
  const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const fixes = [];

  // Check common fixable issues
  if (api.status !== 'active') {
    fixes.push({
      issue: 'API not active',
      autoFix: true,
      action: `PUT /api/v1/apis/${api.slug}`,
      body: { status: 'active' },
    });
  }

  if (api.visibility === 'private') {
    fixes.push({
      issue: 'API is private (not in marketplace)',
      autoFix: true,
      action: `PUT /api/v1/apis/${api.slug}`,
      body: { visibility: 'public' },
    });
  }

  if (api.rate_limit < 50) {
    fixes.push({
      issue: 'Rate limit very low',
      autoFix: true,
      action: `PUT /api/v1/apis/${api.slug}`,
      body: { rate_limit: 1000 },
    });
  }

  const keys = db.prepare('SELECT COUNT(*) as c FROM api_keys WHERE api_id = ? AND is_active = 1').get(api.id);
  if (keys.c === 0) {
    fixes.push({
      issue: 'No API keys — API is inaccessible',
      autoFix: false,
      action: `POST /api/v1/keys/${api.id}`,
      body: { name: 'default-key', permissions: 'read,write' },
    });
  }

  res.json({
    success: true,
    api: api.name,
    fixes,
    fixesAvailable: fixes.length,
    message: fixes.length === 0 ? 'No issues found! Your API is healthy.' : `Found ${fixes.length} fixable issue(s).`,
  });
});

// Helper functions
function getErrorExplanation(code) {
  const explanations = {
    400: 'Bad Request — The data sent was invalid or missing required fields.',
    401: 'Unauthorized — Missing or invalid API key / token.',
    403: 'Forbidden — You don\'t have permission to access this resource.',
    404: 'Not Found — The endpoint or resource ID doesn\'t exist.',
    405: 'Method Not Allowed — This HTTP method isn\'t supported for this endpoint.',
    409: 'Conflict — A duplicate entry or conflicting state.',
    429: 'Too Many Requests — Rate limit exceeded.',
    500: 'Internal Server Error — Something went wrong on the server.',
  };
  return explanations[code] || `HTTP Error ${code}`;
}

function getErrorSolution(code, method, endpoint) {
  const solutions = {
    400: 'Check that your request body has all required fields with correct types. Use the OpenAPI spec to see expected format.',
    401: 'Include the X-API-Key header with a valid key, or Authorization: Bearer <token> for authenticated routes.',
    403: 'Verify your API key has the correct permissions (read/write/delete).',
    404: `Check that the endpoint "${endpoint}" exists and the resource ID is valid. Use GET to list all items first.`,
    429: 'Wait and retry later, or upgrade your plan for higher rate limits.',
    500: 'This is a server error. Check your schema definition for issues, or contact support.',
  };
  return solutions[code] || 'Check the API documentation for details on this endpoint.';
}

export default router;
