# 🔥 APIForge

### The API Marketplace Engine — Create, Publish, Sell & Consume APIs in Minutes

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-blue?logo=express)](https://expressjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## 🎯 What is APIForge?

APIForge is a **complete API marketplace platform** where anyone can:

1. **Create** — Define your API schema and it generates a fully functional REST API instantly
2. **Publish** — List it on the marketplace for others to discover
3. **Monetize** — Set your pricing (free, pay-per-request, or monthly subscriptions)
4. **Consume** — Subscribe to APIs, get auto-generated SDKs, and start building

> Think "Shopify for APIs" — but the products are auto-generated and instantly deployable.

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/kepabilbao67-bot/api-generate.js.git
cd api-generate.js

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start the server
npm start
```

Server starts at `http://localhost:3000`

---

## 📦 Create Your First API in 60 Seconds

### 1. Register an account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "username": "mycreator",
    "password": "SecurePass123"
  }'
```

### 2. Generate an API from a schema

```bash
curl -X POST http://localhost:3000/api/v1/apis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pet Store",
    "description": "Complete pet management API",
    "category": "ecommerce",
    "resources": [
      {
        "name": "Pet",
        "fields": [
          { "name": "name", "type": "string", "required": true },
          { "name": "species", "type": "string", "required": true },
          { "name": "breed", "type": "string" },
          { "name": "age", "type": "integer" },
          { "name": "adopted", "type": "boolean", "default": false }
        ]
      }
    ],
    "pricing": { "model": "freemium", "perRequest": 0.001, "monthly": 9.99 }
  }'
```

### 3. Your API is live! Others can consume it:

```bash
curl -X GET http://localhost:3000/api/v1/live/pet-store/pets \
  -H "X-API-Key: afk_live_xxxxx"
```

---

## 🏗️ Architecture

```
src/
├── server.js              # Express server + middleware
├── config/                # Environment configuration
├── core/                  # 🧠 API Generation Engine
│   ├── engine.js          # Main engine (generate, execute, route matching)
│   ├── endpoint-generator.js  # CRUD endpoint generation
│   ├── validation-generator.js # Joi schema generation
│   └── docs-generator.js  # OpenAPI 3.0 spec generation
├── auth/                  # 🔐 Authentication & Security
│   ├── jwt.js             # Token generation/verification
│   ├── passwords.js       # Bcrypt hashing
│   ├── api-keys.js        # API key management (afk_live_xxx format)
│   └── users.js           # User registration/login/profiles
├── marketplace/           # 🛒 API Marketplace
│   ├── registry.js        # Browse, search, subscribe
│   └── categories.js      # 14 predefined categories
├── billing/               # 💰 Monetization
│   ├── stripe.js          # Stripe Connect, payouts, webhooks
│   └── plans.js           # Plan limits, quotas, upgrades
├── analytics/             # 📊 Real-time Analytics
│   ├── dashboard.js       # Metrics, percentiles, errors
│   └── tracker.js         # Request logging middleware
├── seo/                   # 🔍 SEO Engine
│   ├── engine.js          # Dynamic landing pages, structured data
│   └── sitemap.js         # XML sitemap, robots.txt
├── sdk/                   # 📦 SDK Generator
│   └── builder.js         # JS/TS/Python/cURL SDK generation
├── middleware/            # Express middleware
│   └── auth.js            # JWT + API Key auth middleware
├── routes/                # API routes
│   ├── auth.routes.js
│   ├── api.routes.js
│   ├── marketplace.routes.js
│   ├── live.routes.js
│   ├── analytics.routes.js
│   ├── billing.routes.js
│   ├── sdk.routes.js
│   └── seo.routes.js
└── utils/
    └── database.js        # SQLite with WAL mode
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Auth** | | |
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Get profile |
| **API Management** | | |
| POST | `/api/v1/apis` | Generate new API |
| GET | `/api/v1/apis` | List my APIs |
| GET | `/api/v1/apis/:slug` | API details |
| PUT | `/api/v1/apis/:slug` | Update settings |
| DELETE | `/api/v1/apis/:slug` | Delete API |
| **Marketplace** | | |
| GET | `/api/v1/marketplace` | Browse APIs |
| GET | `/api/v1/marketplace/featured` | Trending APIs |
| GET | `/api/v1/marketplace/categories` | Categories |
| POST | `/api/v1/marketplace/:slug/subscribe` | Subscribe + get key |
| **Live APIs** | | |
| ALL | `/api/v1/live/:slug/*` | Consume generated APIs |
| **Analytics** | | |
| GET | `/api/v1/analytics/overview` | Dashboard overview |
| GET | `/api/v1/analytics/:slug` | API metrics |
| GET | `/api/v1/analytics/:slug/realtime` | Real-time stats |
| **Billing** | | |
| GET | `/api/v1/billing/plans` | View plans |
| POST | `/api/v1/billing/subscribe` | Upgrade plan |
| GET | `/api/v1/billing/earnings` | Creator earnings |
| **SDKs** | | |
| GET | `/api/v1/sdk/:slug/:language` | Generate SDK |

---

## 💰 Monetization Model

| Plan | Price | APIs | Requests/mo | Revenue Share |
|------|-------|------|-------------|---------------|
| Free | $0 | 3 | 10K | 20% to platform |
| Starter | $9/mo | 10 | 100K | 15% to platform |
| Pro | $29/mo | 50 | 1M | 10% to platform |
| Enterprise | $99/mo | Unlimited | Unlimited | 5% to platform |

Creators earn from **pay-per-request** and **monthly subscriptions** to their APIs.

---

## 🔍 SEO Features

- **Programmatic landing pages** — Every published API gets its own SEO-optimized page
- **Schema.org structured data** — JSON-LD for rich search results
- **Dynamic XML sitemaps** — Auto-updated as APIs are published
- **Open Graph + Twitter Cards** — Social sharing optimization
- **robots.txt** — Proper crawl directives

---

## 🛡️ Security

- JWT authentication with refresh tokens
- Bcrypt password hashing (12 rounds)
- API keys with prefix identification (`afk_live_`, `afk_test_`)
- Per-key rate limiting with headers
- Helmet security headers
- CORS configuration
- Request body size limits

---

## 🧰 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4.x
- **Database:** SQLite (better-sqlite3) with WAL mode
- **Auth:** JWT + bcrypt
- **Payments:** Stripe Connect
- **Validation:** Joi
- **Security:** Helmet, CORS, Rate Limiting

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>APIForge</strong> — The future of the API economy starts here.
</p>
