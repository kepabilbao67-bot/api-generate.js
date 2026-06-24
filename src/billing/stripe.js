/**
 * Stripe Integration
 * Handles payments, subscriptions, and payouts for API creators
 */

import Stripe from 'stripe';
import { config } from '../config/index.js';
import db from '../utils/database.js';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

/**
 * Platform pricing plans
 */
export const PLATFORM_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    apisLimit: 3,
    requestsPerMonth: 10000,
    revenueShare: 20, // Platform takes 20%
    features: ['3 APIs', '10K requests/month', 'Community support', 'Basic analytics'],
  },
  starter: {
    name: 'Starter',
    price: 9,
    stripePriceId: 'price_starter_monthly',
    apisLimit: 10,
    requestsPerMonth: 100000,
    revenueShare: 15,
    features: ['10 APIs', '100K requests/month', 'Email support', 'Full analytics', 'Custom domains'],
  },
  pro: {
    name: 'Pro',
    price: 29,
    stripePriceId: 'price_pro_monthly',
    apisLimit: 50,
    requestsPerMonth: 1000000,
    revenueShare: 10,
    features: ['50 APIs', '1M requests/month', 'Priority support', 'Advanced analytics', 'Webhooks', 'Team access'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    stripePriceId: 'price_enterprise_monthly',
    apisLimit: -1, // unlimited
    requestsPerMonth: -1,
    revenueShare: 5,
    features: ['Unlimited APIs', 'Unlimited requests', 'Dedicated support', 'SLA guarantee', 'White-label', 'Custom integrations'],
  },
};

/**
 * Create a Stripe customer for a new user
 */
export async function createCustomer(userId, email, name) {
  if (!stripe) return { id: `mock_cus_${userId}` };

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId, platform: 'apiforge' },
  });

  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
    .run(customer.id, userId);

  return customer;
}


/**
 * Create a Stripe Connect account for API creators (to receive payouts)
 */
export async function createConnectAccount(userId, email) {
  if (!stripe) return { id: `mock_acct_${userId}` };

  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: { userId, platform: 'apiforge' },
  });

  db.prepare('UPDATE users SET stripe_account_id = ? WHERE id = ?')
    .run(account.id, userId);

  return account;
}

/**
 * Create onboarding link for Connect account
 */
export async function createOnboardingLink(accountId, returnUrl) {
  if (!stripe) return { url: `${returnUrl}?onboarding=mock` };

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${returnUrl}/refresh`,
    return_url: `${returnUrl}/complete`,
    type: 'account_onboarding',
  });

  return link;
}

/**
 * Create a checkout session for platform subscription
 */
export async function createSubscriptionCheckout(userId, planId, successUrl, cancelUrl) {
  const plan = PLATFORM_PLANS[planId];
  if (!plan || plan.price === 0) {
    throw new Error('Invalid plan or free plan selected');
  }

  if (!stripe) {
    return { url: `${successUrl}?session=mock_session`, sessionId: 'mock_session' };
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  const session = await stripe.checkout.sessions.create({
    customer: user.stripe_customer_id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: plan.stripePriceId,
      quantity: 1,
    }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { userId, planId },
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Create a payment for API consumption (pay-per-request billing)
 */
export async function chargeForApiUsage(consumerId, apiId, requestCount) {
  const api = db.prepare('SELECT * FROM apis WHERE id = ?').get(apiId);
  if (!api || api.price_per_request === 0) return null;

  const amount = Math.round(api.price_per_request * requestCount * 100); // cents
  if (amount < 50) return null; // Minimum $0.50

  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(api.owner_id);
  const consumer = db.prepare('SELECT * FROM users WHERE id = ?').get(consumerId);
  const platformPlan = PLATFORM_PLANS[owner.plan || 'free'];
  const platformFee = Math.round(amount * (platformPlan.revenueShare / 100));

  if (!stripe) {
    // Mock mode - just record the revenue
    recordRevenue(apiId, consumerId, amount / 100, 'usage', 'mock_payment');
    return { charged: amount / 100, platformFee: platformFee / 100 };
  }

  // Charge the consumer and transfer to API creator
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    customer: consumer.stripe_customer_id,
    transfer_data: {
      destination: owner.stripe_account_id,
      amount: amount - platformFee,
    },
    metadata: { apiId, consumerId, requestCount: String(requestCount) },
  });

  recordRevenue(apiId, consumerId, amount / 100, 'usage', paymentIntent.id);

  return {
    charged: amount / 100,
    platformFee: platformFee / 100,
    creatorEarnings: (amount - platformFee) / 100,
    paymentId: paymentIntent.id,
  };
}


/**
 * Handle Stripe webhooks
 */
export async function handleWebhook(payload, signature) {
  if (!stripe) return { received: true, mock: true };

  const event = stripe.webhooks.constructEvent(
    payload, signature, config.stripe.webhookSecret
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { userId, planId } = session.metadata;
      db.prepare("UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?")
        .run(planId, userId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
        .get(subscription.customer);
      if (user) {
        db.prepare("UPDATE users SET plan = 'free', updated_at = datetime('now') WHERE id = ?")
          .run(user.id);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      // Record subscription payment
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      // Handle failed payment - notify user
      break;
    }
  }

  return { received: true, type: event.type };
}

/**
 * Get creator earnings dashboard data
 */
export function getCreatorEarnings(userId) {
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM revenue_events
    WHERE api_id IN (SELECT id FROM apis WHERE owner_id = ?)
  `).get(userId);

  const monthlyRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM revenue_events
    WHERE api_id IN (SELECT id FROM apis WHERE owner_id = ?)
    AND created_at > datetime('now', '-30 days')
  `).get(userId);

  const revenueByApi = db.prepare(`
    SELECT a.name, a.slug, COALESCE(SUM(r.amount), 0) as revenue,
           COUNT(r.id) as transactions
    FROM apis a
    LEFT JOIN revenue_events r ON a.id = r.api_id
    WHERE a.owner_id = ?
    GROUP BY a.id
    ORDER BY revenue DESC
  `).all(userId);

  const revenueHistory = db.prepare(`
    SELECT date(created_at) as date, SUM(amount) as amount
    FROM revenue_events
    WHERE api_id IN (SELECT id FROM apis WHERE owner_id = ?)
    AND created_at > datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(userId);

  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
  const platformPlan = PLATFORM_PLANS[user?.plan || 'free'];

  return {
    totalRevenue: totalRevenue.total,
    monthlyRevenue: monthlyRevenue.total,
    revenueShare: platformPlan.revenueShare,
    netEarnings: totalRevenue.total * (1 - platformPlan.revenueShare / 100),
    revenueByApi,
    revenueHistory,
    plan: user?.plan || 'free',
  };
}

/**
 * Record a revenue event
 */
function recordRevenue(apiId, userId, amount, type, stripePaymentId) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  db.prepare(`
    INSERT INTO revenue_events (id, api_id, user_id, amount, type, stripe_payment_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, apiId, userId, amount, type, stripePaymentId);

  // Update API total revenue
  db.prepare('UPDATE apis SET total_revenue = total_revenue + ? WHERE id = ?')
    .run(amount, apiId);
}
