/**
 * Affiliate / Referral System
 * GET  /api/v1/affiliates/link          - Get my referral link
 * GET  /api/v1/affiliates/stats         - Referral stats & earnings
 * POST /api/v1/affiliates/register/:code - Register via referral
 * GET  /api/v1/affiliates/payouts       - Payout history
 * 
 * Referrers earn 20% of referred user's first 3 months
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../config/index.js';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS affiliates (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    referrals_count INTEGER DEFAULT 0,
    total_earnings REAL DEFAULT 0,
    pending_earnings REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    affiliate_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    earnings REAL DEFAULT 0,
    months_tracked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
  );
`);

// Get or create affiliate link
router.get('/link', requireAuth, (req, res) => {
  let affiliate = db.prepare('SELECT * FROM affiliates WHERE user_id = ?')
    .get(req.user.userId);

  if (!affiliate) {
    const id = uuidv4();
    const code = crypto.randomBytes(6).toString('hex');
    db.prepare('INSERT INTO affiliates (id, user_id, code) VALUES (?,?,?)')
      .run(id, req.user.userId, code);
    affiliate = { id, code, referrals_count: 0, total_earnings: 0 };
  }

  res.json({
    success: true,
    affiliate: {
      code: affiliate.code,
      link: `${config.baseUrl}/register?ref=${affiliate.code}`,
      referrals: affiliate.referrals_count,
      totalEarnings: affiliate.total_earnings,
      pendingEarnings: affiliate.pending_earnings || 0,
    },
    terms: {
      commission: '20% of referred user platform fees',
      duration: 'First 3 months after signup',
      minimumPayout: '$10',
      payoutMethod: 'Stripe / Bank Transfer',
    },
  });
});

// Get affiliate stats
router.get('/stats', requireAuth, (req, res) => {
  const affiliate = db.prepare('SELECT * FROM affiliates WHERE user_id = ?')
    .get(req.user.userId);

  if (!affiliate) return res.json({ success: true, message: 'Not an affiliate yet. GET /api/v1/affiliates/link to start.' });

  const referrals = db.prepare(`
    SELECT r.*, u.username, u.email, u.plan, u.created_at as user_joined
    FROM referrals r
    JOIN users u ON r.referred_user_id = u.id
    WHERE r.affiliate_id = ?
    ORDER BY r.created_at DESC
  `).all(affiliate.id);

  const monthlyEarnings = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, SUM(earnings) as total
    FROM referrals
    WHERE affiliate_id = ? AND earnings > 0
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all(affiliate.id);

  res.json({
    success: true,
    stats: {
      totalReferrals: affiliate.referrals_count,
      activeReferrals: referrals.filter(r => r.status === 'active').length,
      totalEarnings: affiliate.total_earnings,
      pendingEarnings: affiliate.pending_earnings || 0,
      conversionRate: referrals.length > 0 
        ? `${((referrals.filter(r => r.earnings > 0).length / referrals.length) * 100).toFixed(0)}%`
        : '0%',
    },
    referrals: referrals.map(r => ({
      username: r.username,
      plan: r.plan || 'free',
      earnings: r.earnings,
      status: r.status,
      joinedAt: r.user_joined,
    })),
    monthlyEarnings,
  });
});

// Track referral on registration (called during signup)
router.post('/track', (req, res) => {
  const { referralCode, userId } = req.body;
  if (!referralCode || !userId) return res.status(400).json({ error: 'referralCode and userId required' });

  const affiliate = db.prepare('SELECT * FROM affiliates WHERE code = ?').get(referralCode);
  if (!affiliate) return res.status(404).json({ error: 'Invalid referral code' });

  // Don't allow self-referral
  if (affiliate.user_id === userId) return res.status(400).json({ error: 'Cannot refer yourself' });

  const id = uuidv4();
  try {
    db.prepare('INSERT INTO referrals (id, affiliate_id, referred_user_id) VALUES (?,?,?)')
      .run(id, affiliate.id, userId);
    db.prepare('UPDATE affiliates SET referrals_count = referrals_count + 1 WHERE id = ?')
      .run(affiliate.id);
    res.json({ success: true, message: 'Referral tracked' });
  } catch (e) {
    res.status(400).json({ error: 'User already referred' });
  }
});

export default router;
