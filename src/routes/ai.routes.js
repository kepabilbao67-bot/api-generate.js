/**
 * AI Generation Routes
 * POST /api/v1/ai/generate      - Generate API from text
 * POST /api/v1/ai/suggest       - Get suggestions for schema
 * POST /api/v1/ai/deploy        - Generate + deploy in one step
 */

import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { generateFromText } from '../ai/generator.js';
import apiEngine from '../core/engine.js';
import { canCreateApi } from '../billing/plans.js';

const router = Router();

// Generate schema from natural language (preview)
router.post('/generate', optionalAuth, (req, res) => {
  try {
    const { description, language } = req.body;

    if (!description) {
      return res.status(400).json({
        error: 'Description is required',
        example: 'I want an API for a restaurant with menu items, reservations, and reviews',
        tips: [
          'Describe what your API should manage',
          'Mention specific resources (products, users, orders)',
          'Include details like pricing, location, or ratings',
          'Works in English and Spanish',
        ],
      });
    }

    const schema = generateFromText(description);

    res.json({
      success: true,
      message: 'Schema generated successfully! Review and deploy when ready.',
      schema,
      preview: {
        endpoints: schema.resources.reduce((sum, r) => sum + 4, 0),
        resources: schema.resources.length,
        fields: schema.resources.reduce((sum, r) => sum + r.fields.length, 0),
      },
      nextStep: 'POST /api/v1/ai/deploy with this schema to create your API',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate + deploy in one shot
router.post('/deploy', requireAuth, async (req, res) => {
  try {
    const { description, customizations } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Check plan limits
    const check = canCreateApi(req.user.userId);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Plan limit reached', ...check });
    }

    // Generate schema from text
    let schema = generateFromText(description);

    // Apply customizations if provided
    if (customizations) {
      if (customizations.name) schema.name = customizations.name;
      if (customizations.pricing) schema.pricing = customizations.pricing;
      if (customizations.visibility) schema.visibility = customizations.visibility;
    }

    // Deploy the API
    const result = await apiEngine.generate(schema, req.user.userId);

    res.status(201).json({
      success: true,
      message: `API "${schema.name}" created from your description!`,
      api: result,
      aiMetadata: schema._ai,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get AI suggestions to improve a schema
router.post('/suggest', (req, res) => {
  try {
    const { schema } = req.body;

    if (!schema || !schema.resources) {
      return res.status(400).json({ error: 'Schema with resources is required' });
    }

    const suggestions = [];

    schema.resources.forEach(resource => {
      if (resource.fields.length < 3) {
        suggestions.push({
          type: 'add_fields',
          resource: resource.name,
          message: `"${resource.name}" has few fields. Consider adding more for a richer API.`,
          suggestedFields: getSuggestedFields(resource.name),
        });
      }

      if (!resource.fields.some(f => f.required)) {
        suggestions.push({
          type: 'add_validation',
          resource: resource.name,
          message: `Add required fields to "${resource.name}" for data integrity.`,
        });
      }
    });

    if (schema.resources.length === 1) {
      suggestions.push({
        type: 'add_resource',
        message: 'Single-resource APIs are simple but limited. Consider adding related resources.',
        examples: getRelatedResources(schema.resources[0].name),
      });
    }

    if (!schema.pricing || schema.pricing.model === 'free') {
      suggestions.push({
        type: 'monetization',
        message: 'Consider adding a pricing model to earn from your API.',
        options: ['freemium', 'pay-per-request', 'monthly subscription'],
      });
    }

    res.json({ success: true, suggestions, count: suggestions.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function getSuggestedFields(resourceName) {
  const common = {
    Product: ['sku', 'weight', 'dimensions', 'brand', 'warranty'],
    User: ['avatar', 'timezone', 'preferences', 'lastLogin'],
    Order: ['total', 'tax', 'shipping', 'trackingNumber', 'paymentMethod'],
    Post: ['slug', 'readTime', 'featured', 'seoTitle', 'canonicalUrl'],
  };
  return common[resourceName] || ['description', 'tags', 'status', 'metadata'];
}

function getRelatedResources(resourceName) {
  const related = {
    Product: ['Category', 'Review', 'Order'],
    User: ['Post', 'Comment', 'Activity'],
    Event: ['Ticket', 'Attendee', 'Speaker'],
    Course: ['Lesson', 'Student', 'Quiz'],
  };
  return related[resourceName] || ['Category', 'Comment', 'Tag'];
}

export default router;
