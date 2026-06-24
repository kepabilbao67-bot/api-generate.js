/**
 * Two-Factor Authentication (2FA)
 * POST /api/v1/2fa/setup    - Generate 2FA secret + QR
 * POST /api/v1/2fa/verify   - Verify and enable 2FA
 * POST /api/v1/2fa/disable  - Disable 2FA
 * POST /api/v1/2fa/validate - Validate 2FA token on login
 * 
 * Uses TOTP (Time-based One-Time Password) compatible
 * with Google Authenticator, Authy, etc.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import crypto from 'crypto';
import db from '../utils/database.js';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS two_factor (
    user_id TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    is_enabled INTEGER DEFAULT 0,
    backup_codes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Setup 2FA - generate secret
router.post('/setup', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM two_factor WHERE user_id = ?')
    .get(req.user.userId);

  if (existing?.is_enabled) {
    return res.status(400).json({ error: '2FA is already enabled' });
  }

  // Generate secret (Base32-like)
  const secret = crypto.randomBytes(20).toString('hex').toUpperCase().slice(0, 16);

  // Generate backup codes
  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex')
  );

  // Store (not yet enabled)
  db.prepare(`
    INSERT OR REPLACE INTO two_factor (user_id, secret, backup_codes)
    VALUES (?, ?, ?)
  `).run(req.user.userId, secret, JSON.stringify(backupCodes));

  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.userId);
  const otpAuthUrl = `otpauth://totp/APIForge:${user.email}?secret=${secret}&issuer=APIForge&digits=6&period=30`;

  res.json({
    success: true,
    setup: {
      secret,
      otpAuthUrl,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`,
      backupCodes,
      instructions: [
        '1. Open Google Authenticator or Authy',
        '2. Scan the QR code or enter the secret manually',
        '3. Enter the 6-digit code to verify',
        '4. Save backup codes in a safe place',
      ],
    },
    nextStep: 'POST /api/v1/2fa/verify with { "code": "123456" }',
  });
});

// Verify and enable 2FA
router.post('/verify', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '6-digit code required' });

  const record = db.prepare('SELECT * FROM two_factor WHERE user_id = ?')
    .get(req.user.userId);
  if (!record) return res.status(400).json({ error: 'Setup 2FA first' });

  // Validate TOTP code
  const isValid = validateTOTP(record.secret, code);
  if (!isValid) return res.status(400).json({ error: 'Invalid code. Try again.' });

  // Enable 2FA
  db.prepare('UPDATE two_factor SET is_enabled = 1 WHERE user_id = ?')
    .run(req.user.userId);

  res.json({
    success: true,
    message: '2FA enabled successfully!',
    backupCodes: JSON.parse(record.backup_codes),
    warning: 'Save your backup codes! They are the only way to recover your account if you lose your authenticator.',
  });
});

// Disable 2FA
router.post('/disable', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Current 2FA code required to disable' });

  const record = db.prepare('SELECT * FROM two_factor WHERE user_id = ?')
    .get(req.user.userId);
  if (!record || !record.is_enabled) return res.status(400).json({ error: '2FA is not enabled' });

  const isValid = validateTOTP(record.secret, code);
  if (!isValid) return res.status(400).json({ error: 'Invalid code' });

  db.prepare('DELETE FROM two_factor WHERE user_id = ?').run(req.user.userId);
  res.json({ success: true, message: '2FA disabled' });
});

// Validate 2FA on login
router.post('/validate', (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: 'userId and code required' });

  const record = db.prepare('SELECT * FROM two_factor WHERE user_id = ? AND is_enabled = 1')
    .get(userId);
  if (!record) return res.json({ success: true, required: false });

  // Check backup codes
  const backupCodes = JSON.parse(record.backup_codes || '[]');
  if (backupCodes.includes(code)) {
    const remaining = backupCodes.filter(c => c !== code);
    db.prepare('UPDATE two_factor SET backup_codes = ? WHERE user_id = ?')
      .run(JSON.stringify(remaining), userId);
    return res.json({ success: true, valid: true, method: 'backup_code', remainingCodes: remaining.length });
  }

  const isValid = validateTOTP(record.secret, code);
  res.json({ success: true, valid: isValid, method: isValid ? 'totp' : 'invalid' });
});

/**
 * Simple TOTP validation (compatible with Google Authenticator)
 */
function validateTOTP(secret, code) {
  const timeStep = 30;
  const now = Math.floor(Date.now() / 1000);

  // Check current and adjacent time windows (±1 step for clock drift)
  for (let i = -1; i <= 1; i++) {
    const counter = Math.floor((now + i * timeStep) / timeStep);
    const generated = generateTOTP(secret, counter);
    if (generated === code.padStart(6, '0')) return true;
  }
  return false;
}

function generateTOTP(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

export default router;
