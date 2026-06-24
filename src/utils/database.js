import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Ensure data directory exists
const dbDir = dirname(config.database.path);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.database.path);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    stripe_customer_id TEXT,
    stripe_account_id TEXT,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- APIs table (the core of the marketplace)
  CREATE TABLE IF NOT EXISTS apis (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT,
    version TEXT DEFAULT '1.0.0',
    status TEXT DEFAULT 'draft',
    visibility TEXT DEFAULT 'public',
    pricing_model TEXT DEFAULT 'free',
    price_per_request REAL DEFAULT 0,
    monthly_price REAL DEFAULT 0,
    rate_limit INTEGER DEFAULT 100,
    schema_definition TEXT NOT NULL,
    generated_code TEXT,
    endpoints_count INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    avg_latency REAL DEFAULT 0,
    uptime REAL DEFAULT 100,
    tags TEXT,
    documentation TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  -- API Keys for consumers
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    key_value TEXT UNIQUE NOT NULL,
    name TEXT,
    permissions TEXT DEFAULT 'read',
    rate_limit INTEGER DEFAULT 100,
    requests_used INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );

  -- API Subscriptions
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'active',
    requests_this_month INTEGER DEFAULT 0,
    monthly_limit INTEGER DEFAULT 1000,
    started_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );

  -- Request logs for analytics
  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id TEXT NOT NULL,
    api_key_id TEXT,
    method TEXT,
    endpoint TEXT,
    status_code INTEGER,
    latency_ms REAL,
    ip_address TEXT,
    user_agent TEXT,
    request_body TEXT,
    response_size INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );

  -- Revenue tracking
  CREATE TABLE IF NOT EXISTS revenue_events (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'usd',
    type TEXT,
    stripe_payment_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_apis_slug ON apis(slug);
  CREATE INDEX IF NOT EXISTS idx_apis_owner ON apis(owner_id);
  CREATE INDEX IF NOT EXISTS idx_apis_status ON apis(status);
  CREATE INDEX IF NOT EXISTS idx_apis_category ON apis(category);
  CREATE INDEX IF NOT EXISTS idx_api_keys_value ON api_keys(key_value);
  CREATE INDEX IF NOT EXISTS idx_request_logs_api ON request_logs(api_id);
  CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
`);

export default db;
