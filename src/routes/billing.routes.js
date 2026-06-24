/**
 * Billing Routes
 * GET  /api/v1/billing/plans         - Available plans
 * GET  /api/v1/billing/my-plan       - Current user plan
 * POST /api/v1/billing/subscribe     - Subscribe to platform plan
 * GET  /api/v1/billing/earnings      - Creator earnings
 * POST /api/v1/billing/connect       - Setup Stripe Connect (payouts)
 * POST /api/v1/billing/webhook       - Stripe webhook
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PLATFORM_PLANS, createSubscriptionCheckout, createConnectAccount, createOnboardingLink, getCreatorEarnings, handleWebhook } from '../billing/stripe.js';
import { getUserPlanDetails } from '../billing/plans.js';
import { config } from '../config/index.js';

const router = Router();

// List available plans
router.get('/plans', (req, res) => {
  res.json({ success: true, plans: PLATFORM_PLANS });
});

// Get current plan details
router.get('/my-plan', requireAuth, (req, res) => {
  const plan = getUserPlanDetails(req.user.userId);
  res.json({ success: true, ...plan });
});

// Subscribe to a platform plan
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId || !PLATFORM_PLANS[planId]) {
      return res.status(400).json({ error: 'Invalid plan. Options: starter, pro, enterprise' });
    }

    const result = await createSubscriptionCheckout(
      req.user.userId,
      planId,
      `${config.baseUrl}/billing/success`,
      `${config.baseUrl}/billing/cancel`
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get creator earnings dashboard
router.get('/earnings', requireAuth, (req, res) => {
  const earnings = getCreatorEarnings(req.user.userId);
  res.json({ success: true, ...earnings });
});

// Setup Stripe Connect for receiving payouts
router.post('/connect', requireAuth, async (req, res) => {
  try {
    const account = await createConnectAccount(req.user.userId, req.user.email);
    const link = await createOnboardingLink(account.id, `${config.baseUrl}/billing`);
    res.json({ success: true, onboardingUrl: link.url, accountId: account.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Stripe webhook (raw body required)
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await handleWebhook(req.body, signature);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
