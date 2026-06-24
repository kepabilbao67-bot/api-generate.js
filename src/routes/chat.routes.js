/**
 * Chat API Creator - Conversational API generation
 * POST /api/v1/chat    - Send message to AI assistant
 * 
 * The user chats naturally and the system creates APIs step by step
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateFromText } from '../ai/generator.js';
import apiEngine from '../core/engine.js';
import { createApiKey } from '../auth/api-keys.js';
import { config } from '../config/index.js';
import db from '../utils/database.js';

const router = Router();

// In-memory chat sessions
const sessions = new Map();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const userId = req.user.userId;
    const sid = sessionId || `session_${userId}_${Date.now()}`;

    // Get or create session
    if (!sessions.has(sid)) {
      sessions.set(sid, { messages: [], schema: null, state: 'greeting' });
    }
    const session = sessions.get(sid);
    session.messages.push({ role: 'user', content: message });

    // Process message based on state
    let reply;

    switch (session.state) {
      case 'greeting':
        reply = processGreeting(message, session);
        break;
      case 'describe':
        reply = processDescription(message, session);
        break;
      case 'refine':
        reply = processRefinement(message, session);
        break;
      case 'confirm':
        reply = await processConfirmation(message, session, userId);
        break;
      case 'done':
        reply = { text: 'Your API is already created! Use the credentials above. Say "new" to start over.', state: 'done' };
        if (message.toLowerCase().includes('new') || message.toLowerCase().includes('otra')) {
          sessions.delete(sid);
          reply = { text: "Let's start fresh! What kind of API do you need?", state: 'greeting' };
        }
        break;
      default:
        reply = { text: "What kind of API do you need? Describe it in your own words.", state: 'describe' };
    }

    session.state = reply.state || session.state;
    session.messages.push({ role: 'assistant', content: reply.text });

    res.json({
      success: true,
      sessionId: sid,
      reply: reply.text,
      state: session.state,
      schema: session.schema || null,
      api: reply.api || null,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function processGreeting(message, session) {
  const lower = message.toLowerCase();

  // Check if user already describes what they want
  if (lower.length > 20 && (lower.includes('api') || lower.includes('want') || lower.includes('need') || lower.includes('quiero') || lower.includes('necesito'))) {
    return processDescription(message, session);
  }

  return {
    text: `Hey! I'm your API assistant. Tell me what you need and I'll create it for you instantly.\n\nExamples:\n• "I need an API to manage my clients and projects"\n• "Create a recipe API with ingredients and steps"\n• "API for tracking daily expenses"\n\nWhat would you like to build?`,
    state: 'describe',
  };
}

function processDescription(message, session) {
  try {
    const schema = generateFromText(message);
    session.schema = schema;

    const resourceList = schema.resources.map(r => 
      `• **${r.name}** (${r.fields.length} fields: ${r.fields.slice(0, 4).map(f => f.name).join(', ')}${r.fields.length > 4 ? '...' : ''})`
    ).join('\n');

    const endpointCount = schema.resources.length * 4;

    return {
      text: `Great! Here's what I'll create:\n\n**${schema.name}** — ${schema.description}\n\nResources:\n${resourceList}\n\n📊 ${endpointCount} endpoints | Category: ${schema.category}\n\nWant me to:\n1. **Deploy it** as-is (say "yes" or "deploy")\n2. **Add/change** something (describe what)\n3. **Start over** (say "new")`,
      state: 'confirm',
    };
  } catch (err) {
    return {
      text: `I couldn't understand that fully. Can you be more specific? For example: "I want an API for a gym with members, classes, and trainers"`,
      state: 'describe',
    };
  }
}

function processRefinement(message, session) {
  // Re-generate with additional context
  const originalDesc = session.messages.find(m => m.role === 'user' && m.content.length > 20)?.content || '';
  const combined = `${originalDesc}. Also: ${message}`;

  return processDescription(combined, session);
}

async function processConfirmation(message, session, userId) {
  const lower = message.toLowerCase();

  if (lower.includes('yes') || lower.includes('si') || lower.includes('deploy') || lower.includes('crear') || lower.includes('ok') || lower.includes('go')) {
    // Deploy the API
    if (!session.schema) {
      return { text: 'No schema ready. Describe your API first.', state: 'describe' };
    }

    try {
      session.schema.visibility = 'private';
      session.schema.pricing = { model: 'free' };

      const result = await apiEngine.generate(session.schema, userId);

      // Auto-generate key
      const apiRecord = db.prepare('SELECT id FROM apis WHERE slug = ?').get(result.slug);
      const apiKey = createApiKey(userId, apiRecord.id, {
        name: `chat-${result.slug}`,
        permissions: 'read,write,delete',
        rateLimit: 999999,
      });

      const baseUrl = `${config.baseUrl}/api/v1/live/${result.slug}`;

      return {
        text: `🎉 **Done!** Your "${session.schema.name}" API is live!\n\n🔗 **Base URL:** ${baseUrl}\n🔑 **API Key:** ${apiKey.key}\n📄 **Docs:** ${config.baseUrl}/api/v1/personal/${result.slug}/docs\n📋 **Spec:** ${config.baseUrl}/api/v1/personal/${result.slug}/spec\n\n**Quick test:**\n\`\`\`\ncurl "${baseUrl}" -H "X-API-Key: ${apiKey.key}"\n\`\`\`\n\nSay "new" to create another API!`,
        state: 'done',
        api: { slug: result.slug, baseUrl, apiKey: apiKey.key },
      };
    } catch (err) {
      return { text: `Error creating API: ${err.message}. Try again or describe differently.`, state: 'describe' };
    }
  }

  if (lower.includes('new') || lower.includes('otra') || lower.includes('start')) {
    session.schema = null;
    return { text: "Fresh start! What API do you want to build?", state: 'describe' };
  }

  // User wants to modify
  return processRefinement(message, session);
}

export default router;
