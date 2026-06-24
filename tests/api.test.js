/**
 * APIForge Integration Tests
 * Run: npm test
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const BASE = 'http://localhost:3000';
let token = '';
let apiSlug = '';
let apiKey = '';

describe('APIForge Integration Tests', () => {
  test('Health check', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'healthy');
  });

  test('Register user', async () => {
    const res = await fetch(`${BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test${Date.now()}@test.com`,
        username: `tester${Date.now()}`,
        password: 'TestPass123!',
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.ok(data.token);
    token = data.token;
  });

  test('Quick create API', async () => {
    const res = await fetch(`${BASE}/api/v1/quick/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.ok(data.apiKey);
    apiKey = data.apiKey;
    apiSlug = data.api.slug;
  });

  test('Create item via live API', async () => {
    const res = await fetch(`${BASE}/api/v1/live/${apiSlug}/notes`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Note', content: 'Hello world' }),
    });
    const data = await res.json();
    assert.strictEqual(data.status, 201);
    assert.ok(data.data.id);
  });

  test('List items via live API', async () => {
    const res = await fetch(`${BASE}/api/v1/live/${apiSlug}/notes`, {
      headers: { 'X-API-Key': apiKey },
    });
    const data = await res.json();
    assert.ok(data.data.length > 0);
    assert.ok(data.meta.total > 0);
  });

  test('Get OpenAPI spec', async () => {
    const res = await fetch(`${BASE}/api/v1/personal/${apiSlug}/spec`);
    const data = await res.json();
    assert.strictEqual(data.openapi, '3.0.3');
    assert.ok(data.paths);
  });

  test('AI generate schema', async () => {
    const res = await fetch(`${BASE}/api/v1/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'API for a gym with members and classes' }),
    });
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.schema.resources.length > 0);
  });

  test('List templates', async () => {
    const res = await fetch(`${BASE}/api/v1/templates`);
    const data = await res.json();
    assert.ok(data.templates.length >= 8);
  });

  test('Billing plans', async () => {
    const res = await fetch(`${BASE}/api/v1/billing/plans`);
    const data = await res.json();
    assert.ok(data.plans.free);
    assert.ok(data.plans.pro);
  });
});
