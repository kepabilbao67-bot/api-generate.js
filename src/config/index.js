import dotenv from 'dotenv';
dotenv.config();

const DEV_JWT_SECRET = 'dev-secret-change-in-production';
const PLACEHOLDER_JWT_SECRETS = new Set([
  DEV_JWT_SECRET,
  'your-super-secret-jwt-key-change-this',
  'genera-un-string-random-de-64-caracteres-aqui',
]);

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || PLACEHOLDER_JWT_SECRETS.has(secret) || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set to a random string of at least 32 characters in production.'
      );
    }
    return secret;
  }
  return secret || DEV_JWT_SECRET;
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || 3000}`),
  
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  database: {
    path: process.env.DATABASE_PATH || './data/apiforge.db',
  },

  seo: {
    siteName: process.env.SITE_NAME || 'APIForge',
    siteDescription: process.env.SITE_DESCRIPTION || 'Create, publish, and monetize APIs in minutes',
    siteUrl: process.env.SITE_URL || process.env.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || 3000}`),
  },
};
