/**
 * Review Routes
 * POST   /api/v1/reviews/:slug         - Create review
 * GET    /api/v1/reviews/:slug         - Get reviews
 * POST   /api/v1/reviews/:id/helpful   - Mark helpful
 * DELETE /api/v1/reviews/:id           - Delete review
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createReview, getApiReviews, markReviewHelpful, deleteReview } from '../reviews/system.js';
import db from '../utils/database.js';

const router = Router();

// Create a review
router.post('/:slug', requireAuth, (req, res) => {
  try {
    const api = db.prepare("SELECT id FROM apis WHERE slug = ?")
      .get(req.params.slug);
    if (!api) return res.status(404).json({ error: 'API not found' });

    const { rating, title, content } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating (1-5) is required' });

    const review = createReview(req.user.userId, api.id, { rating, title, content });
    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get reviews for an API
router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?")
    .get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { page, limit, sort } = req.query;
  const result = getApiReviews(api.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sort,
  });

  res.json({ success: true, ...result });
});

// Mark review as helpful
router.post('/:id/helpful', (req, res) => {
  markReviewHelpful(req.params.id);
  res.json({ success: true, message: 'Marked as helpful' });
});

// Delete review
router.delete('/:id', requireAuth, (req, res) => {
  const deleted = deleteReview(req.params.id, req.user.userId);
  if (!deleted) return res.status(404).json({ error: 'Review not found' });
  res.json({ success: true, message: 'Review deleted' });
});

export default router;
