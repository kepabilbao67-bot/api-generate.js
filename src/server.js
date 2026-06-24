/**
 * APIForge - Main Server
 * The API Marketplace where anyone can create, publish, sell and consume APIs
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import apiRoutes from './routes/api.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import liveRoutes from './routes/live.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import billingRoutes from './routes/billing.routes.js';
import sdkRoutes from './routes/sdk.routes.js';
import seoRoutes from './routes/seo.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import aiRoutes from './routes/ai.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import statusRoutes from './routes/status.routes.js';
import domainsRoutes from './routes/domains.routes.js';
import versioningRoutes from './routes/versioning.routes.js';
import adminRoutes from './routes/admin.routes.js';
import pluginsRoutes from './routes/plugins.routes.js';
import discussionsRoutes from './routes/discussions.routes.js';
import changelogRoutes from './routes/changelog.routes.js';
import importExportRoutes from './routes/import-export.routes.js';
import personalRoutes from './routes/personal.routes.js';
import quickRoutes from './routes/quick.routes.js';
import searchRoutes from './routes/search.routes.js';
import graphqlRoutes from './routes/graphql.routes.js';
import chatRoutes from './routes/chat.routes.js';
import batchRoutes from './routes/batch.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import exportDataRoutes from './routes/export-data.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';
import playgroundRoutes from './routes/playground.routes.js';
import cronRoutes from './routes/cron.routes.js';
import usageRoutes from './routes/usage.routes.js';
import cloneRoutes from './routes/clone.routes.js';
import backupRoutes from './routes/backup.routes.js';
import i18nRoutes from './routes/i18n.routes.js';
import calculatorRoutes from './routes/calculator.routes.js';
import keysRoutes from './routes/keys.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import logsRoutes from './routes/logs.routes.js';
import relationshipsRoutes from './routes/relationships.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import eventsRoutes from './routes/events.routes.js';
import sandboxRoutes from './routes/sandbox.routes.js';
import affiliatesRoutes from './routes/affiliates.routes.js';
import twofaRoutes from './routes/twofa.routes.js';
import compareRoutes from './routes/compare.routes.js';

// Initialize database (runs schema creation)
import './utils/database.js';

const app = express();

// ===========================================
// Middleware
// ===========================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for SEO pages
}));

// CORS - allow all origins for API access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Request logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);


// ===========================================
// Routes
// ===========================================

// API routes (authenticated)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/apis', apiRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/live', liveRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/sdk', sdkRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/domains', domainsRoutes);
app.use('/api/v1/versions', versioningRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/plugins', pluginsRoutes);
app.use('/api/v1/discussions', discussionsRoutes);
app.use('/api/v1/changelog', changelogRoutes);
app.use('/api/v1', importExportRoutes);
app.use('/api/v1/personal', personalRoutes);
app.use('/api/v1/quick', quickRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/query', graphqlRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/batch', batchRoutes);
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/data', exportDataRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/playground', playgroundRoutes);
app.use('/api/v1/cron', cronRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/clone', cloneRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/i18n', i18nRoutes);
app.use('/api/v1/calculator', calculatorRoutes);
app.use('/api/v1/keys', keysRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/logs', logsRoutes);
app.use('/api/v1/relationships', relationshipsRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/sandbox', sandboxRoutes);
app.use('/api/v1/affiliates', affiliatesRoutes);
app.use('/api/v1/2fa', twofaRoutes);
app.use('/api/v1/compare', compareRoutes);
app.use('/status', statusRoutes);

// Static files (landing page, dashboard)
app.use(express.static('public'));

// SEO routes (public, HTML)
app.use('/', seoRoutes);

// ===========================================
// Health & Info
// ===========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'APIForge',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1', (req, res) => {
  res.json({
    name: 'APIForge API',
    version: '1.0.0',
    description: 'Create, publish, and monetize APIs in minutes',
    endpoints: {
      auth: '/api/v1/auth',
      apis: '/api/v1/apis',
      marketplace: '/api/v1/marketplace',
      live: '/api/v1/live/:slug',
      analytics: '/api/v1/analytics',
      billing: '/api/v1/billing',
      sdk: '/api/v1/sdk',
    },
    documentation: `${config.seo.siteUrl}/docs`,
  });
});

// ===========================================
// Error Handling
// ===========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    docs: `${config.seo.siteUrl}/docs`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  res.status(err.status || 500).json({
    error: config.nodeEnv === 'production' ? 'Internal Server Error' : err.message,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
});

// ===========================================
// Start Server
// ===========================================

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   🔥 APIForge v1.0.0                            ║
  ║   The API Marketplace Engine                     ║
  ║                                                  ║
  ║   Server:    http://localhost:${PORT}              ║
  ║   API Base:  http://localhost:${PORT}/api/v1       ║
  ║   Health:    http://localhost:${PORT}/health        ║
  ║   Env:       ${config.nodeEnv}                           ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
  `);
});

export default app;
