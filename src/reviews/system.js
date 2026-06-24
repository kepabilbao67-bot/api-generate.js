/**
 * Review & Rating System
 * Users can rate and review APIs they've consumed
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../utils/database.js';

// Ensure reviews table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    helpful_count INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(api_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_api
    ON reviews(api_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_rating
    ON reviews(rating);
`);


/**
 * Create a review for an API
 */
export function createReview(userId, apiId, { rating, title, content }) {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Check if user has subscribed to this API
  const subscription = db.prepare(
    "SELECT id FROM subscriptions WHERE user_id = ? AND api_id = ?"
  ).get(userId, apiId);

  const isVerified = !!subscription;

  const id = uuidv4();
  try {
    db.prepare(`
      INSERT INTO reviews (id, api_id, user_id, rating, title, content, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, apiId, userId, rating, title || '', content || '', isVerified ? 1 : 0);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      throw new Error('You have already reviewed this API');
    }
    throw err;
  }

  // Update API average rating
  updateApiRating(apiId);

  return { id, rating, title, content, isVerified, createdAt: new Date().toISOString() };
}

/**
 * Get reviews for an API
 */
export function getApiReviews(apiId, options = {}) {
  const { page = 1, limit = 10, sort = 'newest' } = options;
  const offset = (page - 1) * limit;

  const sortMap = {
    newest: 'r.created_at DESC',
    oldest: 'r.created_at ASC',
    highest: 'r.rating DESC',
    lowest: 'r.rating ASC',
    helpful: 'r.helpful_count DESC',
  };
  const orderBy = sortMap[sort] || sortMap.newest;

  const reviews = db.prepare(`
    SELECT r.*, u.username, u.display_name as author_name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.api_id = ?
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(apiId, limit, offset);

  const stats = getReviewStats(apiId);

  return { reviews, stats, page, limit };
}


/**
 * Get review statistics for an API
 */
export function getReviewStats(apiId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(rating) as average,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
    FROM reviews WHERE api_id = ?
  `).get(apiId);

  return {
    totalReviews: stats.total,
    averageRating: Math.round((stats.average || 0) * 10) / 10,
    distribution: {
      5: stats.five_star || 0,
      4: stats.four_star || 0,
      3: stats.three_star || 0,
      2: stats.two_star || 0,
      1: stats.one_star || 0,
    },
  };
}

/**
 * Update API's cached rating
 */
function updateApiRating(apiId) {
  const stats = db.prepare('SELECT AVG(rating) as avg FROM reviews WHERE api_id = ?').get(apiId);
  if (stats.avg) {
    db.prepare("UPDATE apis SET uptime = ?, updated_at = datetime('now') WHERE id = ?")
      .run(Math.round(stats.avg * 20), apiId); // Store as 0-100 scale
  }
}

/**
 * Mark a review as helpful
 */
export function markReviewHelpful(reviewId) {
  db.prepare('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?').run(reviewId);
}

/**
 * Delete a review (only by author)
 */
export function deleteReview(reviewId, userId) {
  const result = db.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?')
    .run(reviewId, userId);
  return result.changes > 0;
}
