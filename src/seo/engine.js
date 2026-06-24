/**
 * SEO Engine
 * Generates dynamic landing pages, sitemaps, and structured data
 * for each published API to maximize organic search visibility
 */

import { config } from '../config/index.js';
import db from '../utils/database.js';
import { getCategoryById } from '../marketplace/categories.js';

/**
 * Generate SEO-optimized HTML landing page for an API
 */
export function generateApiLandingPage(slug) {
  const api = db.prepare(`
    SELECT a.*, u.username as creator, u.display_name as creator_name
    FROM apis a
    JOIN users u ON a.owner_id = u.id
    WHERE a.slug = ? AND a.status = 'active'
  `).get(slug);

  if (!api) return null;

  const category = getCategoryById(api.category);
  const tags = api.tags ? JSON.parse(api.tags) : [];
  const schema = JSON.parse(api.schema_definition);
  const endpoints = api.endpoints_count;

  return {
    html: buildLandingHTML(api, category, tags, schema),
    meta: buildMetaTags(api, category, tags),
    structuredData: buildStructuredData(api, category),
    canonical: `${config.seo.siteUrl}/api/${api.slug}`,
  };
}

/**
 * Build full HTML landing page
 */
function buildLandingHTML(api, category, tags, schema) {
  const { siteUrl, siteName } = config.seo;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${buildHeadSection(api, category, tags)}
</head>
<body>
  <header>
    <nav>
      <a href="${siteUrl}">${siteName}</a>
      <a href="${siteUrl}/marketplace">Marketplace</a>
      <a href="${siteUrl}/docs">Docs</a>
      <a href="${siteUrl}/pricing">Pricing</a>
    </nav>
  </header>
  
  <main>
    <section class="api-hero">
      <span class="category-badge">${category.icon} ${category.name}</span>
      <h1>${api.name} API</h1>
      <p class="description">${api.description}</p>
      <div class="stats-bar">
        <span>${api.endpoints_count} Endpoints</span>
        <span>${formatNumber(api.total_requests)} Requests</span>
        <span>${api.avg_latency}ms Avg Latency</span>
        <span>${api.uptime}% Uptime</span>
      </div>
      <div class="cta-buttons">
        <a href="${siteUrl}/api/${api.slug}/subscribe" class="btn-primary">Get API Key - ${api.pricing_model === 'free' ? 'Free' : `$${api.monthly_price}/mo`}</a>
        <a href="${siteUrl}/api/${api.slug}/docs" class="btn-secondary">View Documentation</a>
      </div>
    </section>

    <section class="api-details">
      <h2>Available Endpoints</h2>
      <div class="endpoints-list">
        ${buildEndpointsList(schema)}
      </div>
    </section>

    <section class="api-pricing">
      <h2>Pricing Plans</h2>
      ${buildPricingSection(api)}
    </section>

    <section class="api-code-example">
      <h2>Quick Start</h2>
      ${buildCodeExamples(api)}
    </section>

    <section class="creator-info">
      <h3>Created by <a href="${siteUrl}/creators/${api.creator}">${api.creator_name || api.creator}</a></h3>
    </section>

    ${tags.length > 0 ? `
    <section class="tags">
      ${tags.map(t => `<a href="${siteUrl}/marketplace?tags=${t}" class="tag">${t}</a>`).join('')}
    </section>` : ''}
  </main>

  <footer>
    <p>${siteName} - Create, Publish, and Monetize APIs in Minutes</p>
    <nav>
      <a href="${siteUrl}/about">About</a>
      <a href="${siteUrl}/blog">Blog</a>
      <a href="${siteUrl}/privacy">Privacy</a>
      <a href="${siteUrl}/terms">Terms</a>
    </nav>
  </footer>

  <script type="application/ld+json">
    ${JSON.stringify(buildStructuredData(api, category))}
  </script>
</body>
</html>`;
}


/**
 * Build HTML <head> section with meta tags
 */
function buildHeadSection(api, category, tags) {
  const { siteUrl, siteName } = config.seo;
  const title = `${api.name} API - ${category.name} | ${siteName}`;
  const description = `${api.description || `${api.name} API with ${api.endpoints_count} endpoints`}. ${api.pricing_model === 'free' ? 'Free to use.' : `Starting at $${api.monthly_price}/month.`} ${formatNumber(api.total_requests)}+ requests served.`;

  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${tags.join(', ')}, api, ${category.name.toLowerCase()}, rest api, ${api.name.toLowerCase()}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${siteUrl}/api/${api.slug}">

  <!-- Open Graph -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${siteUrl}/api/${api.slug}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:image" content="${siteUrl}/og/${api.slug}.png">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${siteUrl}/og/${api.slug}.png">

  <!-- Additional SEO -->
  <meta name="author" content="${api.creator_name || api.creator}">
  <meta property="article:published_time" content="${api.created_at}">
  <meta property="article:modified_time" content="${api.updated_at}">
  `;
}

/**
 * Build JSON-LD structured data (Schema.org)
 */
function buildStructuredData(api, category) {
  const { siteUrl, siteName } = config.seo;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${api.name} API`,
    description: api.description,
    url: `${siteUrl}/api/${api.slug}`,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: api.monthly_price || 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: calculateRating(api),
      bestRating: 5,
      ratingCount: Math.max(1, Math.floor(api.total_requests / 100)),
    },
    creator: {
      '@type': 'Person',
      name: api.creator_name || api.creator,
      url: `${siteUrl}/creators/${api.creator}`,
    },
    provider: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
  };
}

/**
 * Build meta tags object for API responses
 */
function buildMetaTags(api, category, tags) {
  const { siteUrl, siteName } = config.seo;
  return {
    title: `${api.name} API - ${category.name} | ${siteName}`,
    description: `${api.description || api.name} API. ${api.endpoints_count} endpoints, ${api.avg_latency}ms latency, ${api.uptime}% uptime.`,
    keywords: [...tags, 'api', category.name.toLowerCase(), 'rest api', api.name.toLowerCase()],
    canonical: `${siteUrl}/api/${api.slug}`,
    ogImage: `${siteUrl}/og/${api.slug}.png`,
  };
}


/**
 * Build endpoints list HTML
 */
function buildEndpointsList(schema) {
  if (!schema.resources) return '<p>No endpoints defined</p>';

  return schema.resources.map(resource => {
    const name = resource.name.toLowerCase();
    const plural = name.endsWith('s') ? name : `${name}s`;
    const methods = resource.methods || ['GET', 'POST', 'PUT', 'DELETE'];

    return methods.map(method => {
      const colors = { GET: '#61affe', POST: '#49cc90', PUT: '#fca130', DELETE: '#f93e3e' };
      const path = method === 'GET' || method === 'POST' ? `/${plural}` : `/${plural}/:id`;
      return `<div class="endpoint"><span style="color:${colors[method]}">${method}</span> ${path}</div>`;
    }).join('');
  }).join('');
}

/**
 * Build pricing section HTML
 */
function buildPricingSection(api) {
  if (api.pricing_model === 'free') {
    return `<div class="pricing-card free"><h3>Free</h3><p>Unlimited access</p></div>`;
  }

  return `
    <div class="pricing-cards">
      <div class="pricing-card">
        <h3>Pay Per Request</h3>
        <p class="price">$${api.price_per_request}/request</p>
        <p>Only pay for what you use</p>
      </div>
      <div class="pricing-card featured">
        <h3>Monthly Plan</h3>
        <p class="price">$${api.monthly_price}/month</p>
        <p>Unlimited requests included</p>
      </div>
    </div>`;
}

/**
 * Build code examples section
 */
function buildCodeExamples(api) {
  const { siteUrl } = config.seo;
  const baseUrl = `${siteUrl}/api/v1/live/${api.slug}`;

  return `
    <div class="code-tabs">
      <div class="tab active" data-lang="curl">
        <h4>cURL</h4>
        <pre><code>curl -X GET "${baseUrl}" \\
  -H "X-API-Key: YOUR_API_KEY"</code></pre>
      </div>
      <div class="tab" data-lang="javascript">
        <h4>JavaScript</h4>
        <pre><code>const response = await fetch("${baseUrl}", {
  headers: { "X-API-Key": "YOUR_API_KEY" }
});
const data = await response.json();</code></pre>
      </div>
      <div class="tab" data-lang="python">
        <h4>Python</h4>
        <pre><code>import requests

response = requests.get("${baseUrl}",
  headers={"X-API-Key": "YOUR_API_KEY"})
data = response.json()</code></pre>
      </div>
    </div>`;
}

/**
 * Calculate a rating based on API metrics
 */
function calculateRating(api) {
  let rating = 3.5; // Base rating
  if (api.uptime >= 99.9) rating += 1;
  else if (api.uptime >= 99) rating += 0.5;
  if (api.avg_latency < 100) rating += 0.5;
  if (api.total_requests > 10000) rating += 0.3;
  return Math.min(5, Math.round(rating * 10) / 10);
}

/**
 * Format large numbers (1000 -> 1K, 1000000 -> 1M)
 */
function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num || 0);
}
