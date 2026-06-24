/**
 * Custom Domain Routes
 * POST   /api/v1/domains              - Add custom domain
 * GET    /api/v1/domains              - List my domains
 * POST   /api/v1/domains/:id/verify   - Verify domain
 * DELETE /api/v1/domains/:id          - Remove domain
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { addCustomDomain, verifyDomain, listDomains, removeDomain } from '../domains/manager.js';

const router = Router();

// Add a custom domain
router.post('/', requireAuth, (req, res) => {
  try {
    const { apiId, domain } = req.body;
    if (!apiId || !domain) {
      return res.status(400).json({ error: 'apiId and domain are required' });
    }

    const result = addCustomDomain(req.user.userId, apiId, domain);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List my domains
router.get('/', requireAuth, (req, res) => {
  const domains = listDomains(req.user.userId);
  res.json({ success: true, domains, count: domains.length });
});

// Verify domain
router.post('/:id/verify', requireAuth, async (req, res) => {
  try {
    const result = await verifyDomain(req.params.id, req.user.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove domain
router.delete('/:id', requireAuth, (req, res) => {
  const removed = removeDomain(req.params.id, req.user.userId);
  if (!removed) return res.status(404).json({ error: 'Domain not found' });
  res.json({ success: true, message: 'Domain removed' });
});

export default router;
