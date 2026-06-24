/**
 * Revenue Calculator
 * GET /api/v1/calculator?requests=10000&price=0.001&model=per-request
 * 
 * Helps creators estimate earnings before publishing
 */

import { Router } from 'express';
import { PLATFORM_PLANS } from '../billing/stripe.js';

const router = Router();

router.get('/', (req, res) => {
  const {
    requests = 10000,
    pricePerRequest = 0.001,
    monthlyPrice = 9.99,
    subscribers = 10,
    model = 'per-request',
    plan = 'free',
  } = req.query;

  const reqCount = parseInt(requests);
  const perReq = parseFloat(pricePerRequest);
  const monthly = parseFloat(monthlyPrice);
  const subs = parseInt(subscribers);
  const platformPlan = PLATFORM_PLANS[plan] || PLATFORM_PLANS.free;
  const platformFee = platformPlan.revenueShare / 100;

  let grossRevenue = 0;
  let breakdown = {};

  if (model === 'per-request') {
    grossRevenue = reqCount * perReq;
    breakdown = {
      model: 'Pay Per Request',
      monthlyRequests: reqCount,
      pricePerRequest: perReq,
      grossRevenue,
    };
  } else if (model === 'subscription') {
    grossRevenue = subs * monthly;
    breakdown = {
      model: 'Monthly Subscription',
      subscribers: subs,
      monthlyPrice: monthly,
      grossRevenue,
    };
  } else {
    // Hybrid
    const reqRevenue = reqCount * perReq;
    const subRevenue = subs * monthly;
    grossRevenue = reqRevenue + subRevenue;
    breakdown = {
      model: 'Hybrid (Subscription + Pay Per Use)',
      requestRevenue: reqRevenue,
      subscriptionRevenue: subRevenue,
      grossRevenue,
    };
  }

  const platformCut = grossRevenue * platformFee;
  const netRevenue = grossRevenue - platformCut;
  const annualProjected = netRevenue * 12;

  res.json({
    success: true,
    estimate: {
      ...breakdown,
      platformFee: `${platformPlan.revenueShare}% (${plan} plan)`,
      platformCut: Math.round(platformCut * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      annualProjected: Math.round(annualProjected * 100) / 100,
    },
    tips: [
      netRevenue < 50 ? 'Consider raising your price or switching to subscription model' : null,
      plan === 'free' ? `Upgrade to Pro plan to reduce platform fee from ${platformPlan.revenueShare}% to 10%` : null,
      model === 'per-request' && reqCount < 1000 ? 'Focus on getting more consumers to increase request volume' : null,
    ].filter(Boolean),
    comparison: Object.entries(PLATFORM_PLANS).map(([id, p]) => ({
      plan: id,
      fee: `${p.revenueShare}%`,
      yourEarnings: Math.round(grossRevenue * (1 - p.revenueShare / 100) * 100) / 100,
      monthlyPlanCost: p.price,
      netAfterPlan: Math.round((grossRevenue * (1 - p.revenueShare / 100) - p.price) * 100) / 100,
    })),
  });
});

export default router;
