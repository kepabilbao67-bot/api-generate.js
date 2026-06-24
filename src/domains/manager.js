/**
 * Custom Domain Manager
 * Allows API creators to use their own domain for their APIs
 * e.g., api.mycompany.com instead of apiforge.io/api/v1/live/my-api
 */

import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

// Ensure custom_domains table
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_domains (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    ssl_status TEXT DEFAULT 'pending',
    verification_token TEXT,
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

/**
 * Register a custom domain for an API
 */
export function addCustomDomain(userId, apiId, domain) {
  // Validate domain format
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    throw new Error('Invalid domain format');
  }

  // Check ownership
  const api = db.prepare('SELECT id FROM apis WHERE id = ? AND owner_id = ?')
    .get(apiId, userId);
  if (!api) throw new Error('API not found or not owned by you');

  // Check if domain already taken
  const existing = db.prepare('SELECT id FROM custom_domains WHERE domain = ?')
    .get(domain);
  if (existing) throw new Error('Domain already registered');

  const id = uuidv4();
  const verificationToken = `apiforge-verify-${uuidv4()}`;

  db.prepare(`
    INSERT INTO custom_domains (id, api_id, user_id, domain, verification_token)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, apiId, userId, domain, verificationToken);

  return {
    id,
    domain,
    status: 'pending',
    verification: {
      method: 'DNS TXT Record',
      host: `_apiforge.${domain}`,
      value: verificationToken,
      instructions: [
        `Add a TXT record to your DNS:`,
        `Host: _apiforge.${domain}`,
        `Value: ${verificationToken}`,
        `Then call POST /api/v1/domains/${id}/verify`,
      ],
    },
  };
}

/**
 * Verify domain ownership
 */
export async function verifyDomain(domainId, userId) {
  const record = db.prepare(
    'SELECT * FROM custom_domains WHERE id = ? AND user_id = ?'
  ).get(domainId, userId);

  if (!record) throw new Error('Domain record not found');
  if (record.status === 'active') return { verified: true, domain: record.domain };

  // In production: Check DNS TXT record
  // For now, auto-verify in development
  db.prepare(`
    UPDATE custom_domains 
    SET status = 'active', ssl_status = 'active', verified_at = datetime('now')
    WHERE id = ?
  `).run(domainId);

  return {
    verified: true,
    domain: record.domain,
    ssl: 'active',
    message: `${record.domain} is now active! Your API is accessible at https://${record.domain}`,
  };
}

/**
 * List custom domains for a user
 */
export function listDomains(userId) {
  return db.prepare(`
    SELECT cd.*, a.name as api_name, a.slug as api_slug
    FROM custom_domains cd
    JOIN apis a ON cd.api_id = a.id
    WHERE cd.user_id = ?
    ORDER BY cd.created_at DESC
  `).all(userId);
}

/**
 * Remove a custom domain
 */
export function removeDomain(domainId, userId) {
  const result = db.prepare(
    'DELETE FROM custom_domains WHERE id = ? AND user_id = ?'
  ).run(domainId, userId);
  return result.changes > 0;
}

/**
 * Resolve API from custom domain (for request routing)
 */
export function resolveApiFromDomain(hostname) {
  const record = db.prepare(`
    SELECT cd.*, a.slug as api_slug
    FROM custom_domains cd
    JOIN apis a ON cd.api_id = a.id
    WHERE cd.domain = ? AND cd.status = 'active'
  `).get(hostname);
  return record;
}
