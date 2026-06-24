/**
 * JWT Authentication Module
 * Handles token generation, verification, and refresh
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export function verifyToken(token) {
  try {
    return { valid: true, decoded: jwt.verify(token, config.jwt.secret) };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '30d',
  });
}
