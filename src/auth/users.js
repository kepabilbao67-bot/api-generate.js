/**
 * User Management
 * Registration, login, profile management
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../utils/database.js';
import { hashPassword, comparePassword, validatePasswordStrength } from './passwords.js';
import { generateToken, generateRefreshToken } from './jwt.js';

export async function registerUser({ email, username, password, displayName }) {
  // Validate password strength
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.errors.join('; '));
  }

  // Check if user exists
  const existing = db.prepare(
    'SELECT id FROM users WHERE email = ? OR username = ?'
  ).get(email, username);

  if (existing) {
    throw new Error('User with this email or username already exists');
  }

  const id = uuidv4();
  const passwordHash = await hashPassword(password);

  // First user gets enterprise plan (unlimited), rest get free
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  const ownerEmails = (process.env.OWNER_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  const isOwner = userCount.c === 0 || ownerEmails.includes(email);
  const plan = isOwner ? 'enterprise' : 'free';

  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, display_name, plan)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, email, username, passwordHash, displayName || username, plan);

  const token = generateToken({ userId: id, username, email });
  const refreshToken = generateRefreshToken({ userId: id });

  return {
    user: { id, email, username, displayName: displayName || username, plan: 'free' },
    token,
    refreshToken,
  };
}

export async function loginUser({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const validPassword = await comparePassword(password, user.password_hash);
  if (!validPassword) {
    throw new Error('Invalid email or password');
  }

  // Auto-upgrade owner on login
  const ownerEmails = (process.env.OWNER_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  const isFirstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get()?.id === user.id;
  if ((ownerEmails.includes(email) || isFirstUser) && user.plan !== 'enterprise') {
    db.prepare("UPDATE users SET plan = 'enterprise' WHERE id = ?").run(user.id);
    user.plan = 'enterprise';
  }

  const token = generateToken({ userId: user.id, username: user.username, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      plan: user.plan,
    },
    token,
    refreshToken,
  };
}

export function getUserProfile(userId) {
  const user = db.prepare(`
    SELECT id, email, username, display_name, bio, plan, created_at
    FROM users WHERE id = ?
  `).get(userId);

  if (!user) throw new Error('User not found');

  // Get user stats
  const apiCount = db.prepare('SELECT COUNT(*) as count FROM apis WHERE owner_id = ?').get(userId);
  const totalRequests = db.prepare(
    'SELECT COALESCE(SUM(total_requests), 0) as total FROM apis WHERE owner_id = ?'
  ).get(userId);
  const totalRevenue = db.prepare(
    'SELECT COALESCE(SUM(total_revenue), 0) as total FROM apis WHERE owner_id = ?'
  ).get(userId);

  return {
    ...user,
    stats: {
      apisCreated: apiCount.count,
      totalRequests: totalRequests.total,
      totalRevenue: totalRevenue.total,
    },
  };
}

export function updateUserProfile(userId, updates) {
  const allowed = ['display_name', 'bio'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));

  if (fields.length === 0) throw new Error('No valid fields to update');

  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE users SET ${sets}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...updates, id: userId });

  return getUserProfile(userId);
}
