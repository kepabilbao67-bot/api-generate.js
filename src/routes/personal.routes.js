/**
 * Personal API Routes - FREE unlimited APIs for the platform owner
 * These are YOUR private APIs that work with any tool that asks for one
 * (Zapier, Make, n8n, GPTs, Postman, any integration)
 * 
 * POST /api/v1/personal/create       - Create personal API (no limits)
 * GET  /api/v1/personal              - List your personal APIs
 * GET  /api/v1/personal/:slug/spec   - OpenAPI spec (for tools to read)
 * GET  /api/v1/personal/:slug/docs   - Interactive docs page
 * ALL  /api/v1/personal/:slug/*      - Use your personal API
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import { createApiKey } from '../auth/api-keys.js';
import { generateDocs } from '../core/docs-generator.js';
import { generateEndpoints } from '../core/endpoint-generator.js';
import { config } from '../config/index.js';
import db from '../utils/database.js';

const router = Router();

// Ensure owner_mode flag in config
const OWNER_EMAILS = (process.env.OWNER_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * Check if user is the platform owner (unlimited free access)
 */
function isOwner(userId) {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  // First registered user OR matching owner email = owner
  if (OWNER_EMAILS.length > 0) return OWNER_EMAILS.includes(user.email);
  const first = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
  return first && first.id === userId;
}

// Create personal API (NO LIMITS for owner)
router.post('/create', requireAuth, async (req, res) => {
  try {
    // Owner check - you get unlimited free APIs
    if (!isOwner(req.user.userId)) {
      return res.status(403).json({
        error: 'Personal APIs are for the platform owner. Use /api/v1/apis for marketplace APIs.',
      });
    }

    const schema = req.body;
    if (!schema || !schema.name || !schema.resources) {
      return res.status(400).json({
        error: 'Schema required: { name, resources: [{ name, fields: [...] }] }',
        example: {
          name: 'My Contacts',
          description: 'Personal contacts API',
          resources: [
            {
              name: 'Contact',
              fields: [
                { name: 'name', type: 'string', required: true },
                { name: 'email', type: 'email' },
                { name: 'phone', type: 'string' },
                { name: 'company', type: 'string' },
                { name: 'notes', type: 'string' },
              ],
            },
          ],
        },
      });
    }

    // Force personal settings
    schema.pricing = { model: 'free' };
    schema.visibility = 'private';

    const result = await apiEngine.generate(schema, req.user.userId);

    // Auto-generate permanent API key
    const apiRecord = db.prepare('SELECT id FROM apis WHERE slug = ?').get(result.slug);
    const apiKey = createApiKey(req.user.userId, apiRecord.id, {
      name: `personal-${result.slug}`,
      permissions: 'read,write,delete',
      rateLimit: 999999, // Unlimited for owner
    });

    const baseUrl = `${config.baseUrl}/api/v1/live/${result.slug}`;
    const specUrl = `${config.baseUrl}/api/v1/personal/${result.slug}/spec`;

    res.status(201).json({
      success: true,
      message: `Personal API "${schema.name}" created! Use it anywhere.`,
      api: {
        name: result.name,
        slug: result.slug,
        baseUrl,
        endpoints: result.endpoints,
      },
      credentials: {
        apiKey: apiKey.key,
        headerName: 'X-API-Key',
        note: 'Use this key in any tool that asks for authentication',
      },
      integration: {
        openApiSpec: specUrl,
        curlExample: `curl -X GET "${baseUrl}" -H "X-API-Key: ${apiKey.key}"`,
        zapierNote: 'Use "Webhooks by Zapier" with the baseUrl and API key',
        makeNote: 'Use "HTTP" module with baseUrl and X-API-Key header',
        gptNote: `Import the OpenAPI spec from ${specUrl} as a GPT Action`,
        n8nNote: 'Use "HTTP Request" node with the baseUrl',
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List personal APIs
router.get('/', requireAuth, (req, res) => {
  if (!isOwner(req.user.userId)) {
    return res.status(403).json({ error: 'Owner access only' });
  }

  const apis = db.prepare(`
    SELECT id, name, slug, description, endpoints_count, total_requests, created_at
    FROM apis WHERE owner_id = ? AND visibility = 'private'
    ORDER BY created_at DESC
  `).all(req.user.userId);

  const apisWithUrls = apis.map(api => ({
    ...api,
    baseUrl: `${config.baseUrl}/api/v1/live/${api.slug}`,
    specUrl: `${config.baseUrl}/api/v1/personal/${api.slug}/spec`,
    docsUrl: `${config.baseUrl}/api/v1/personal/${api.slug}/docs`,
  }));

  res.json({ success: true, apis: apisWithUrls, count: apis.length });
});

// OpenAPI spec for any tool to consume (Zapier, GPTs, Make, etc.)
router.get('/:slug/spec', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const schema = JSON.parse(api.schema_definition);
  const endpoints = generateEndpoints(schema);
  const docs = generateDocs(schema, endpoints);

  // Ensure the spec has the correct server URL
  docs.servers = [
    { url: `${config.baseUrl}/api/v1/live/${api.slug}`, description: 'Live API' },
  ];

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(docs);
});

// Interactive docs page (HTML)
router.get('/:slug/docs', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const specUrl = `${config.baseUrl}/api/v1/personal/${api.slug}/spec`;

  // Swagger UI HTML
  const html = `<!DOCTYPE html>
<html><head>
<title>${api.name} - API Docs</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
  url: "${specUrl}",
  dom_id: '#swagger-ui',
  deepLinking: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  layout: "BaseLayout"
});
</script>
</body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
