/**
 * Template Routes
 * GET  /api/v1/templates              - List all templates
 * GET  /api/v1/templates/:id          - Get template details
 * POST /api/v1/templates/:id/deploy   - Deploy a template as your API
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAllTemplates, getTemplateById } from '../templates/index.js';
import apiEngine from '../core/engine.js';
import { canCreateApi } from '../billing/plans.js';

const router = Router();

// List all templates
router.get('/', (req, res) => {
  const templates = getAllTemplates();
  const { category } = req.query;

  const filtered = category
    ? templates.filter(t => t.category === category)
    : templates;

  res.json({
    success: true,
    templates: filtered,
    count: filtered.length,
  });
});

// Get template details
router.get('/:id', (req, res) => {
  const template = getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  res.json({ success: true, template });
});

// Deploy template (1-click API creation)
router.post('/:id/deploy', requireAuth, async (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Check plan limits
    const check = canCreateApi(req.user.userId);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Plan limit reached', ...check });
    }

    // Allow user to customize name/description
    const customSchema = {
      ...template.schema,
      name: req.body.name || template.schema.name,
      description: req.body.description || template.schema.description,
      pricing: req.body.pricing || { model: 'free' },
    };

    const result = await apiEngine.generate(customSchema, req.user.userId);

    res.status(201).json({
      success: true,
      message: `Template "${template.name}" deployed successfully!`,
      api: result,
      template: { id: template.id, name: template.name },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
