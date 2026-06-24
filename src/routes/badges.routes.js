/**
 * Badges & Achievements System
 * Gamification for API creators
 * 
 * GET /api/v1/badges             - List all badges
 * GET /api/v1/badges/my          - My earned badges
 * GET /api/v1/badges/check       - Check & award new badges
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS user_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, badge_id)
  );
`);

// All available badges
const BADGES = [
  { id: 'first-api', name: 'Creator', icon: '🚀', description: 'Created your first API', condition: (s) => s.apis >= 1 },
  { id: 'five-apis', name: 'Prolific', icon: '⚡', description: 'Created 5+ APIs', condition: (s) => s.apis >= 5 },
  { id: 'ten-apis', name: 'Factory', icon: '🏭', description: 'Created 10+ APIs', condition: (s) => s.apis >= 10 },
  { id: 'first-request', name: 'Live!', icon: '📡', description: 'Received first API request', condition: (s) => s.requests >= 1 },
  { id: '1k-requests', name: 'Popular', icon: '🔥', description: '1,000+ total requests', condition: (s) => s.requests >= 1000 },
  { id: '10k-requests', name: 'Viral', icon: '💫', description: '10,000+ total requests', condition: (s) => s.requests >= 10000 },
  { id: '100k-requests', name: 'Legendary', icon: '👑', description: '100,000+ total requests', condition: (s) => s.requests >= 100000 },
  { id: 'first-revenue', name: 'Earner', icon: '💰', description: 'Earned your first dollar', condition: (s) => s.revenue >= 1 },
  { id: '100-revenue', name: 'Monetized', icon: '💵', description: 'Earned $100+', condition: (s) => s.revenue >= 100 },
  { id: '1k-revenue', name: 'Business', icon: '🏆', description: 'Earned $1,000+', condition: (s) => s.revenue >= 1000 },
  { id: 'first-review', name: 'Reviewed', icon: '⭐', description: 'Received first review', condition: (s) => s.reviews >= 1 },
  { id: 'five-star', name: 'Excellent', icon: '🌟', description: 'Average rating 4.5+', condition: (s) => s.avgRating >= 4.5 },
  { id: 'first-subscriber', name: 'Subscribed', icon: '🔔', description: 'Got first subscriber', condition: (s) => s.subscribers >= 1 },
  { id: 'team-player', name: 'Team Player', icon: '🤝', description: 'Created a team', condition: (s) => s.teams >= 1 },
  { id: 'referrer', name: 'Ambassador', icon: '📣', description: 'Referred 3+ users', condition: (s) => s.referrals >= 3 },
  { id: 'speed-demon', name: 'Speed Demon', icon: '⚡', description: 'All APIs under 100ms avg', condition: (s) => s.allFast },
  { id: 'uptime-king', name: 'Reliable', icon: '🛡️', description: '99.9%+ uptime across all APIs', condition: (s) => s.uptime >= 99.9 },
  { id: 'early-adopter', name: 'Early Adopter', icon: '🎯', description: 'Joined in first month', condition: (s) => s.earlyAdopter },
];

// List all available badges
router.get('/', (req, res) => {
  res.json({
    success: true,
    badges: BADGES.map(b => ({ id: b.id, name: b.name, icon: b.icon, description: b.description })),
    total: BADGES.length,
  });
});

// Get my earned badges
router.get('/my', requireAuth, (req, res) => {
  const earned = db.prepare(`
    SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?
  `).all(req.user.userId);

  const earnedIds = new Set(earned.map(e => e.badge_id));

  const myBadges = BADGES.map(b => ({
    ...b,
    condition: undefined,
    earned: earnedIds.has(b.id),
    earnedAt: earned.find(e => e.badge_id === b.id)?.earned_at || null,
  }));

  res.json({
    success: true,
    earned: myBadges.filter(b => b.earned),
    locked: myBadges.filter(b => !b.earned),
    progress: `${earned.length}/${BADGES.length}`,
  });
});

// Check and award new badges
router.get('/check', requireAuth, (req, res) => {
  const userId = req.user.userId;

  // Get user stats
  const apis = db.prepare('SELECT COUNT(*) as c FROM apis WHERE owner_id = ?').get(userId);
  const requests = db.prepare('SELECT COALESCE(SUM(total_requests),0) as t FROM apis WHERE owner_id = ?').get(userId);
  const revenue = db.prepare('SELECT COALESCE(SUM(total_revenue),0) as t FROM apis WHERE owner_id = ?').get(userId);
  const reviews = db.prepare(`SELECT COUNT(*) as c FROM reviews WHERE api_id IN (SELECT id FROM apis WHERE owner_id = ?)`).get(userId);
  const subs = db.prepare(`SELECT COUNT(*) as c FROM subscriptions WHERE api_id IN (SELECT id FROM apis WHERE owner_id = ?)`).get(userId);
  const teams = db.prepare('SELECT COUNT(*) as c FROM teams WHERE owner_id = ?').get(userId);

  const stats = {
    apis: apis.c,
    requests: requests.t,
    revenue: revenue.t,
    reviews: reviews.c,
    subscribers: subs.c,
    teams: teams.c,
    referrals: 0,
    avgRating: 0,
    allFast: true,
    uptime: 99.9,
    earlyAdopter: false,
  };

  // Check each badge
  const newBadges = [];
  for (const badge of BADGES) {
    if (badge.condition(stats)) {
      try {
        db.prepare('INSERT INTO user_badges (id, user_id, badge_id) VALUES (?,?,?)')
          .run(uuidv4(), userId, badge.id);
        newBadges.push({ id: badge.id, name: badge.name, icon: badge.icon });
      } catch { /* already earned */ }
    }
  }

  res.json({
    success: true,
    newBadges,
    message: newBadges.length > 0 ? `🎉 You earned ${newBadges.length} new badge(s)!` : 'No new badges yet. Keep building!',
  });
});

export default router;
