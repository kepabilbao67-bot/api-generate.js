/**
 * Plan Management
 * Check limits, upgrade/downgrade logic
 */

import db from '../utils/database.js';
import { PLATFORM_PLANS } from './stripe.js';

/**
 * Check if user can create a new API based on their plan
 */
export function canCreateApi(userId) {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
  const plan = PLATFORM_PLANS[user?.plan || 'free'];

  if (plan.apisLimit === -1) return { allowed: true }; // Unlimited

  const apiCount = db.prepare(
    'SELECT COUNT(*) as count FROM apis WHERE owner_id = ?'
  ).get(userId);

  if (apiCount.count >= plan.apisLimit) {
    return {
      allowed: false,
      reason: `You have reached the limit of ${plan.apisLimit} APIs on the ${plan.name} plan. Upgrade to create more.`,
      currentCount: apiCount.count,
      limit: plan.apisLimit,
      suggestedPlan: getSuggestedUpgrade(user?.plan || 'free'),
    };
  }

  return { allowed: true, remaining: plan.apisLimit - apiCount.count };
}

/**
 * Check if API has remaining requests for the month
 */
export function checkRequestQuota(apiId, userId) {
  const subscription = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE api_id = ? AND user_id = ? AND status = 'active'
  `).get(apiId, userId);

  if (!subscription) {
    return { allowed: false, reason: 'Not subscribed to this API' };
  }

  if (subscription.monthly_limit === -1) return { allowed: true }; // Unlimited

  if (subscription.requests_this_month >= subscription.monthly_limit) {
    return {
      allowed: false,
      reason: 'Monthly request limit reached',
      used: subscription.requests_this_month,
      limit: subscription.monthly_limit,
    };
  }

  return {
    allowed: true,
    remaining: subscription.monthly_limit - subscription.requests_this_month,
  };
}

/**
 * Increment request count for a subscription
 */
export function incrementRequestCount(apiId, userId) {
  db.prepare(`
    UPDATE subscriptions 
    SET requests_this_month = requests_this_month + 1
    WHERE api_id = ? AND user_id = ? AND status = 'active'
  `).run(apiId, userId);
}

/**
 * Get suggested upgrade plan
 */
function getSuggestedUpgrade(currentPlan) {
  const upgradeMap = {
    free: 'starter',
    starter: 'pro',
    pro: 'enterprise',
    enterprise: null,
  };
  const nextPlan = upgradeMap[currentPlan];
  return nextPlan ? { id: nextPlan, ...PLATFORM_PLANS[nextPlan] } : null;
}

/**
 * Get user's current plan details
 */
export function getUserPlanDetails(userId) {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
  const planId = user?.plan || 'free';
  const plan = PLATFORM_PLANS[planId];

  const apiCount = db.prepare(
    'SELECT COUNT(*) as count FROM apis WHERE owner_id = ?'
  ).get(userId);

  return {
    planId,
    ...plan,
    usage: {
      apisCreated: apiCount.count,
      apisLimit: plan.apisLimit,
      apisRemaining: plan.apisLimit === -1 ? 'unlimited' : plan.apisLimit - apiCount.count,
    },
    upgradeTo: getSuggestedUpgrade(planId),
  };
}

/**
 * Reset all monthly request counters (run monthly via cron)
 */
export function resetMonthlyCounters() {
  db.prepare("UPDATE subscriptions SET requests_this_month = 0 WHERE status = 'active'").run();
}
