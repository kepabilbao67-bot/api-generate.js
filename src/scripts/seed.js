/**
 * Seed Script - Populate database with demo data
 * Run: npm run seed
 */

import '../utils/database.js';
import db from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getAllTemplates, getTemplateById } from '../templates/index.js';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Create demo users
  const users = [
    { id: uuidv4(), email: 'admin@apiforge.io', username: 'apiforge', displayName: 'APIForge Team', plan: 'enterprise' },
    { id: uuidv4(), email: 'creator@demo.com', username: 'demo_creator', displayName: 'Demo Creator', plan: 'pro' },
    { id: uuidv4(), email: 'consumer@demo.com', username: 'demo_consumer', displayName: 'Demo Consumer', plan: 'starter' },
  ];

  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  for (const user of users) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, username, password_hash, display_name, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, user.email, user.username, passwordHash, user.displayName, user.plan);
  }
  console.log(`✅ Created ${users.length} demo users`);


  // Deploy some templates as demo APIs
  const templates = ['ecommerce-products', 'blog-cms', 'ai-prompts', 'crypto-portfolio'];
  let apisCreated = 0;

  for (const templateId of templates) {
    const template = getTemplateById(templateId);
    if (!template) continue;

    const apiId = uuidv4();
    const slug = template.schema.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const pricingModels = ['free', 'freemium', 'paid'];
    const pricing = pricingModels[Math.floor(Math.random() * pricingModels.length)];

    db.prepare(`
      INSERT OR IGNORE INTO apis (id, owner_id, name, slug, description, category, version, status, visibility, pricing_model, price_per_request, monthly_price, rate_limit, schema_definition, generated_code, endpoints_count, total_requests, total_revenue, avg_latency, uptime, tags)
      VALUES (?, ?, ?, ?, ?, ?, '1.0.0', 'active', 'public', ?, ?, ?, 1000, ?, '{}', ?, ?, ?, ?, 99.9, ?)
    `).run(
      apiId,
      users[1].id, // demo_creator
      template.schema.name,
      slug,
      template.schema.description,
      template.schema.category,
      pricing,
      pricing === 'paid' ? 0.001 : 0,
      pricing === 'paid' ? 9.99 : 0,
      JSON.stringify(template.schema),
      template.schema.resources.length * 4, // CRUD = 4 endpoints per resource
      Math.floor(Math.random() * 50000) + 1000,
      Math.floor(Math.random() * 500),
      Math.floor(Math.random() * 80) + 20,
      JSON.stringify(template.tags)
    );

    apisCreated++;
  }
  console.log(`✅ Created ${apisCreated} demo APIs from templates`);

  // Create some request logs for analytics
  const apis = db.prepare('SELECT id FROM apis').all();
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const statusCodes = [200, 200, 200, 200, 201, 400, 404, 500]; // Weighted towards success

  let logsCreated = 0;
  for (const api of apis) {
    for (let i = 0; i < 100; i++) {
      const method = methods[Math.floor(Math.random() * methods.length)];
      const status = statusCodes[Math.floor(Math.random() * statusCodes.length)];
      const latency = Math.floor(Math.random() * 200) + 10;
      const daysAgo = Math.floor(Math.random() * 30);

      db.prepare(`
        INSERT INTO request_logs (api_id, method, endpoint, status_code, latency_ms, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', ?))
      `).run(api.id, method, '/resource', status, latency, `-${daysAgo} days`);
      logsCreated++;
    }
  }
  console.log(`✅ Created ${logsCreated} request log entries`);

  // Summary
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Demo accounts:');
  console.log('   Admin:    admin@apiforge.io / Demo1234!');
  console.log('   Creator:  creator@demo.com / Demo1234!');
  console.log('   Consumer: consumer@demo.com / Demo1234!');
  console.log('\n🚀 Start the server with: npm start');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
