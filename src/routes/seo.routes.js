/**
 * SEO Routes - Public pages for search engines
 * GET /api/:slug               - SEO landing page (HTML)
 * GET /sitemap.xml             - XML Sitemap
 * GET /sitemap-index.xml       - Sitemap index
 * GET /robots.txt              - Robots.txt
 */

import { Router } from 'express';
import { generateApiLandingPage } from '../seo/engine.js';
import { generateSitemap, generateSitemapIndex, generateRobotsTxt } from '../seo/sitemap.js';

const router = Router();

// SEO landing page for each API
router.get('/api/:slug', (req, res) => {
  const page = generateApiLandingPage(req.params.slug);
  if (!page) return res.status(404).send('<h1>API Not Found</h1>');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(page.html);
});

// XML Sitemap
router.get('/sitemap.xml', (req, res) => {
  const sitemap = generateSitemap();
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(sitemap);
});

// Sitemap index
router.get('/sitemap-index.xml', (req, res) => {
  const index = generateSitemapIndex();
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(index);
});

// Robots.txt
router.get('/robots.txt', (req, res) => {
  const robots = generateRobotsTxt();
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(robots);
});

export default router;
