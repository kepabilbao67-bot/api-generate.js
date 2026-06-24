/**
 * Sitemap Generator
 * Generates XML sitemaps for all published APIs and pages
 * Supports sitemap index for large sites (>50K URLs)
 */

import db from '../utils/database.js';
import { config } from '../config/index.js';
import { API_CATEGORIES } from '../marketplace/categories.js';

/**
 * Generate main sitemap XML
 */
export function generateSitemap() {
  const { siteUrl } = config.seo;

  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/marketplace', priority: '0.9', changefreq: 'daily' },
    { url: '/pricing', priority: '0.8', changefreq: 'weekly' },
    { url: '/docs', priority: '0.8', changefreq: 'weekly' },
    { url: '/blog', priority: '0.7', changefreq: 'daily' },
    { url: '/about', priority: '0.5', changefreq: 'monthly' },
  ];

  // Category pages
  const categoryPages = API_CATEGORIES.map(cat => ({
    url: `/marketplace/category/${cat.id}`,
    priority: '0.8',
    changefreq: 'daily',
  }));

  // All published APIs
  const apis = db.prepare(`
    SELECT slug, updated_at FROM apis 
    WHERE status = 'active' AND visibility = 'public'
    ORDER BY total_requests DESC
  `).all();

  const apiPages = apis.map(api => ({
    url: `/api/${api.slug}`,
    priority: '0.9',
    changefreq: 'daily',
    lastmod: api.updated_at,
  }));

  // Creator pages
  const creators = db.prepare(`
    SELECT DISTINCT u.username, MAX(a.updated_at) as last_updated
    FROM users u
    JOIN apis a ON u.id = a.owner_id
    WHERE a.status = 'active'
    GROUP BY u.username
  `).all();

  const creatorPages = creators.map(c => ({
    url: `/creators/${c.username}`,
    priority: '0.6',
    changefreq: 'weekly',
    lastmod: c.last_updated,
  }));

  const allPages = [...staticPages, ...categoryPages, ...apiPages, ...creatorPages];

  return buildSitemapXml(siteUrl, allPages);
}

/**
 * Generate sitemap index (for large sites)
 */
export function generateSitemapIndex() {
  const { siteUrl } = config.seo;
  const now = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-apis.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-creators.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;
}

/**
 * Generate robots.txt
 */
export function generateRobotsTxt() {
  const { siteUrl } = config.seo;

  return `# APIForge Robots.txt
User-agent: *
Allow: /
Allow: /api/
Allow: /marketplace/
Allow: /creators/
Allow: /docs/
Allow: /blog/

Disallow: /dashboard/
Disallow: /settings/
Disallow: /api/v1/
Disallow: /admin/

# Sitemaps
Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/sitemap-index.xml

# Crawl-delay
Crawl-delay: 1
`;
}

/**
 * Build XML sitemap from pages array
 */
function buildSitemapXml(siteUrl, pages) {
  const urls = pages.map(page => `  <url>
    <loc>${siteUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}
