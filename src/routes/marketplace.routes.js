/**
 * Marketplace Routes (Public browsing + subscription)
 * GET  /api/v1/marketplace             - Browse APIs
 * GET  /api/v1/marketplace/featured    - Featured/trending APIs
 * GET  /api/v1/marketplace/categories  - List categories
 * GET  /api/v1/marketplace/:slug       - API detail page
 * POST /api/v1/marketplace/:slug/subscribe - Subscribe to API
 */

import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { listMarketplaceAPIs, getApiDetails, getFeaturedAPIs, getCategories, subscribeToApi } from '../marketplace/registry.js';
import { createApiKey } from '../auth/api-keys.js';
import db from '../utils/database.js';

const router = Router();

// Browse marketplace
router.get('/', (req, res) => {
  const { page, limit, category, search, sort, pricing, tags } = req.query;
  const result = listMarketplaceAPIs({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    category,
    search,
    sort,
    pricingModel: pricing,
    tags,
  });
  res.json({ success: true, ...result });
});

// Featured APIs
router.get('/featured', (req, res) => {
  const featured = getFeaturedAPIs();
  res.json({ success: true, ...featured });
});

// Categories
router.get('/categories', (req, res) => {
  const categories = getCategories();
  res.json({ success: true, categories });
});

// API detail page
router.get('/:slug', (req, res) => {
  const api = getApiDetails(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });
  res.json({ success: true, api });
});

// Subscribe to an API + get API key
router.post('/:slug/subscribe', requireAuth, (req, res) => {
  try {
    const api = db.prepare("SELECT id FROM apis WHERE slug = ? AND status = 'active'")
      .get(req.params.slug);

    if (!api) return res.status(404).json({ error: 'API not found' });

    const plan = req.body.plan || 'free';
    const subscription = subscribeToApi(req.user.userId, api.id, plan);

    // Auto-generate an API key for the subscriber
    const apiKey = createApiKey(req.user.userId, api.id, {
      name: `${req.params.slug}-key`,
      permissions: 'read,write',
      rateLimit: subscription.monthlyLimit,
    });

    res.status(201).json({
      success: true,
      subscription,
      apiKey: {
        key: apiKey.key,
        name: apiKey.name,
        note: 'Save this key! It will not be shown again in full.',
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
