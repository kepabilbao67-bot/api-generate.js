/**
 * Quick API Creator - One-command API creation
 * For the owner to create APIs super fast
 * 
 * POST /api/v1/quick/:name   - Create API just by naming it
 * POST /api/v1/quick/ai      - Create from text description
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import apiEngine from '../core/engine.js';
import { generateFromText } from '../ai/generator.js';
import { createApiKey } from '../auth/api-keys.js';
import { config } from '../config/index.js';
import db from '../utils/database.js';

const router = Router();

// Quick templates for common needs
const QUICK_SCHEMAS = {
  contacts: {
    name: 'Contacts',
    resources: [{ name: 'Contact', fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'email' },
      { name: 'phone', type: 'string' },
      { name: 'company', type: 'string' },
      { name: 'notes', type: 'string' },
      { name: 'tags', type: 'array' },
    ]}],
  },
  tasks: {
    name: 'Tasks',
    resources: [{ name: 'Task', fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string' },
      { name: 'status', type: 'string', enum: ['todo', 'doing', 'done'], default: 'todo' },
      { name: 'priority', type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
      { name: 'dueDate', type: 'date' },
      { name: 'assignee', type: 'string' },
      { name: 'tags', type: 'array' },
    ]}],
  },
  notes: {
    name: 'Notes',
    resources: [{ name: 'Note', fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
      { name: 'category', type: 'string' },
      { name: 'tags', type: 'array' },
      { name: 'pinned', type: 'boolean', default: false },
    ]}],
  },
  bookmarks: {
    name: 'Bookmarks',
    resources: [{ name: 'Bookmark', fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'url', type: 'url', required: true },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'tags', type: 'array' },
      { name: 'favicon', type: 'url' },
    ]}],
  },
  inventory: {
    name: 'Inventory',
    resources: [{ name: 'Item', fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'quantity', type: 'integer', required: true, min: 0 },
      { name: 'location', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'number' },
      { name: 'minStock', type: 'integer', default: 0 },
      { name: 'supplier', type: 'string' },
    ]}],
  },
  leads: {
    name: 'Leads',
    resources: [{ name: 'Lead', fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'company', type: 'string' },
      { name: 'source', type: 'string', enum: ['web', 'referral', 'social', 'ads', 'other'] },
      { name: 'status', type: 'string', enum: ['new', 'contacted', 'qualified', 'converted', 'lost'], default: 'new' },
      { name: 'value', type: 'number' },
      { name: 'notes', type: 'string' },
    ]}],
  },
  passwords: {
    name: 'Passwords',
    resources: [{ name: 'Credential', fields: [
      { name: 'service', type: 'string', required: true },
      { name: 'username', type: 'string', required: true },
      { name: 'password', type: 'string', required: true },
      { name: 'url', type: 'url' },
      { name: 'notes', type: 'string' },
      { name: 'category', type: 'string' },
    ]}],
  },
  expenses: {
    name: 'Expenses',
    resources: [{ name: 'Expense', fields: [
      { name: 'description', type: 'string', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'category', type: 'string', enum: ['food', 'transport', 'housing', 'entertainment', 'health', 'other'] },
      { name: 'date', type: 'date', required: true },
      { name: 'paymentMethod', type: 'string' },
      { name: 'receipt', type: 'url' },
      { name: 'recurring', type: 'boolean', default: false },
    ]}],
  },
};

// Quick create by name
router.post('/:name', requireAuth, async (req, res) => {
  try {
    const name = req.params.name.toLowerCase();
    let schema = QUICK_SCHEMAS[name];

    if (!schema) {
      // If not a known quick schema, try AI generation
      schema = generateFromText(`API for managing ${name}`);
    }

    schema.visibility = 'private';
    schema.pricing = { model: 'free' };

    const result = await apiEngine.generate(schema, req.user.userId);

    // Auto-generate key
    const apiRecord = db.prepare('SELECT id FROM apis WHERE slug = ?').get(result.slug);
    const apiKey = createApiKey(req.user.userId, apiRecord.id, {
      name: `quick-${result.slug}`,
      permissions: 'read,write,delete',
      rateLimit: 999999,
    });

    const baseUrl = `${config.baseUrl}/api/v1/live/${result.slug}`;

    res.status(201).json({
      success: true,
      message: `"${schema.name}" API created instantly!`,
      api: { name: schema.name, slug: result.slug, baseUrl, endpoints: result.endpoints.length },
      apiKey: apiKey.key,
      quickStart: {
        list: `curl "${baseUrl}" -H "X-API-Key: ${apiKey.key}"`,
        create: `curl -X POST "${baseUrl}" -H "X-API-Key: ${apiKey.key}" -H "Content-Type: application/json" -d '{"name": "example"}'`,
        spec: `${config.baseUrl}/api/v1/personal/${result.slug}/spec`,
        docs: `${config.baseUrl}/api/v1/personal/${result.slug}/docs`,
      },
      availableQuickAPIs: Object.keys(QUICK_SCHEMAS),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create from AI text
router.post('/', requireAuth, async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({
        error: 'Describe what you need',
        examples: [
          'I need an API to manage my clients and their projects',
          'API for tracking my daily habits and streaks',
          'A recipe API with ingredients and cooking steps',
        ],
        quickOptions: Object.keys(QUICK_SCHEMAS),
      });
    }

    const schema = generateFromText(description);
    schema.visibility = 'private';
    schema.pricing = { model: 'free' };

    const result = await apiEngine.generate(schema, req.user.userId);

    const apiRecord = db.prepare('SELECT id FROM apis WHERE slug = ?').get(result.slug);
    const apiKey = createApiKey(req.user.userId, apiRecord.id, {
      name: `ai-${result.slug}`,
      permissions: 'read,write,delete',
      rateLimit: 999999,
    });

    const baseUrl = `${config.baseUrl}/api/v1/live/${result.slug}`;

    res.status(201).json({
      success: true,
      message: `API "${schema.name}" generated from your description!`,
      api: { name: schema.name, slug: result.slug, baseUrl },
      apiKey: apiKey.key,
      spec: `${config.baseUrl}/api/v1/personal/${result.slug}/spec`,
      docs: `${config.baseUrl}/api/v1/personal/${result.slug}/docs`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
