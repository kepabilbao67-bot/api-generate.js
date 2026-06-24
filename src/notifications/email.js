/**
 * Email Notification System
 * Sends transactional emails for key events
 * Uses a pluggable transport (console in dev, SMTP in prod)
 */

import { config } from '../config/index.js';

// Email templates
const TEMPLATES = {
  welcome: {
    subject: 'Welcome to APIForge! 🔥',
    html: (data) => `
      <h1>Welcome, ${data.username}!</h1>
      <p>Your account has been created. Start building APIs now:</p>
      <ol>
        <li>Describe your API or pick a template</li>
        <li>We generate endpoints, docs, and SDKs</li>
        <li>Publish and start earning</li>
      </ol>
      <a href="${config.baseUrl}/dashboard">Go to Dashboard</a>
    `,
  },
  apiPublished: {
    subject: 'Your API is live! 🚀',
    html: (data) => `
      <h1>"${data.apiName}" is now live!</h1>
      <p>Your API is published on the marketplace.</p>
      <ul>
        <li>Endpoints: ${data.endpoints}</li>
        <li>URL: ${config.baseUrl}/api/v1/live/${data.slug}</li>
        <li>Marketplace: ${config.baseUrl}/api/${data.slug}</li>
      </ul>
      <a href="${config.baseUrl}/dashboard">View Analytics</a>
    `,
  },
  newSubscriber: {
    subject: 'New subscriber to your API! 💰',
    html: (data) => `
      <h1>Someone subscribed to "${data.apiName}"</h1>
      <p><strong>${data.subscriber}</strong> just subscribed.</p>
      <p>Plan: ${data.plan} | Total subscribers: ${data.total}</p>
      <a href="${config.baseUrl}/analytics/${data.slug}">View Analytics</a>
    `,
  },
  paymentReceived: {
    subject: 'You earned money! 💸',
    html: (data) => `
      <h1>Payment received: $${data.amount}</h1>
      <p>From: ${data.apiName}</p>
      <p>Total earnings this month: $${data.monthlyTotal}</p>
      <a href="${config.baseUrl}/billing/earnings">View Earnings</a>
    `,
  },
  rateLimitWarning: {
    subject: 'Rate limit warning ⚠️',
    html: (data) => `
      <h1>You're approaching your rate limit</h1>
      <p>API: ${data.apiName}</p>
      <p>Used: ${data.used}/${data.limit} requests this period</p>
      <a href="${config.baseUrl}/billing">Upgrade Plan</a>
    `,
  },
  newReview: {
    subject: 'New review on your API ⭐',
    html: (data) => `
      <h1>${data.reviewer} reviewed "${data.apiName}"</h1>
      <p>Rating: ${'⭐'.repeat(data.rating)}</p>
      <p>"${data.content}"</p>
      <a href="${config.baseUrl}/api/${data.slug}#reviews">View Review</a>
    `,
  },
};

/**
 * Send an email notification
 */
export async function sendEmail(to, templateName, data) {
  const template = TEMPLATES[templateName];
  if (!template) {
    console.error(`Email template "${templateName}" not found`);
    return { sent: false, error: 'Template not found' };
  }

  const email = {
    to,
    subject: template.subject,
    html: template.html(data),
    from: 'APIForge <noreply@apiforge.io>',
    sentAt: new Date().toISOString(),
  };

  // In development, just log
  if (config.nodeEnv !== 'production') {
    console.log(`[EMAIL] To: ${to} | Subject: ${email.subject}`);
    return { sent: true, mode: 'development', email };
  }

  // In production, use SMTP/SendGrid/etc.
  // TODO: Integrate with actual email provider
  try {
    // await smtpTransport.sendMail(email);
    return { sent: true, email };
  } catch (err) {
    console.error(`[EMAIL ERROR] ${err.message}`);
    return { sent: false, error: err.message };
  }
}

/**
 * Send bulk emails (newsletters, announcements)
 */
export async function sendBulkEmail(recipients, templateName, data) {
  const results = [];
  for (const to of recipients) {
    const result = await sendEmail(to, templateName, { ...data, to });
    results.push(result);
    // Rate limit: 10 emails/second
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}
