/**
 * Authentication Routes
 * POST /api/v1/auth/register
 * POST /api/v1/auth/login
 * GET  /api/v1/auth/me
 * PUT  /api/v1/auth/profile
 */

import { Router } from 'express';
import { registerUser, loginUser, getUserProfile, updateUserProfile } from '../auth/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, displayName } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username, and password are required' });
    }

    const result = await registerUser({ email, username, password, displayName });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await loginUser({ email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Get current user profile
router.get('/me', requireAuth, (req, res) => {
  try {
    const profile = getUserProfile(req.user.userId);
    res.json({ success: true, user: profile });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Update profile
router.put('/profile', requireAuth, (req, res) => {
  try {
    const updated = updateUserProfile(req.user.userId, req.body);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
