/**
 * AI API Generator
 * Converts natural language descriptions into API schemas
 * Uses pattern matching + NLP-style parsing (no external AI dependency)
 * 
 * This is the "magic" feature that differentiates APIForge
 */

import { v4 as uuidv4 } from 'uuid';
import { API_CATEGORIES } from '../marketplace/categories.js';

// Common field patterns recognized from natural language
const FIELD_PATTERNS = {
  // Identity
  name: { type: 'string', required: true },
  title: { type: 'string', required: true },
  // Contact
  email: { type: 'email', required: true },
  phone: { type: 'string' },
  address: { type: 'string' },
  website: { type: 'url' },
  url: { type: 'url' },
  // Numeric
  price: { type: 'number', required: true, min: 0 },
  cost: { type: 'number', min: 0 },
  amount: { type: 'number' },
  quantity: { type: 'integer', min: 0 },
  stock: { type: 'integer', min: 0 },
  rating: { type: 'number', min: 0, max: 5 },
  score: { type: 'number' },
  age: { type: 'integer', min: 0 },
  weight: { type: 'number' },
  height: { type: 'number' },
  duration: { type: 'integer' },
  count: { type: 'integer', default: 0 },
  // Text
  description: { type: 'string' },
  content: { type: 'string' },
  bio: { type: 'string' },
  notes: { type: 'string' },
  comment: { type: 'string' },
  summary: { type: 'string' },
  // Boolean
  active: { type: 'boolean', default: true },
  available: { type: 'boolean', default: true },
  published: { type: 'boolean', default: false },
  verified: { type: 'boolean', default: false },
  featured: { type: 'boolean', default: false },
  // Date
  date: { type: 'date' },
  birthday: { type: 'date' },
  startDate: { type: 'date' },
  endDate: { type: 'date' },
  createdAt: { type: 'date' },
  // Media
  image: { type: 'url' },
  photo: { type: 'url' },
  avatar: { type: 'url' },
  thumbnail: { type: 'url' },
  video: { type: 'url' },
  // Arrays
  tags: { type: 'array' },
  categories: { type: 'array' },
  images: { type: 'array' },
  features: { type: 'array' },
  ingredients: { type: 'array' },
  // Relations
  userId: { type: 'uuid' },
  categoryId: { type: 'uuid' },
  parentId: { type: 'uuid' },
  // Enums (common patterns)
  status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
  type: { type: 'string' },
  role: { type: 'string', enum: ['admin', 'user', 'moderator'] },
  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
  size: { type: 'string', enum: ['small', 'medium', 'large', 'xl'] },
  color: { type: 'string' },
  currency: { type: 'string', default: 'USD' },
  language: { type: 'string', default: 'en' },
  country: { type: 'string' },
  city: { type: 'string' },
  location: { type: 'string' },
  latitude: { type: 'number' },
  longitude: { type: 'number' },
};


// Category detection keywords
const CATEGORY_KEYWORDS = {
  'ecommerce': ['product', 'shop', 'store', 'cart', 'order', 'payment', 'inventory', 'catalog', 'price', 'shipping'],
  'social': ['post', 'comment', 'like', 'follow', 'feed', 'profile', 'share', 'friend', 'message', 'chat', 'blog'],
  'finance': ['payment', 'invoice', 'transaction', 'account', 'balance', 'transfer', 'crypto', 'stock', 'portfolio'],
  'health': ['patient', 'appointment', 'doctor', 'health', 'fitness', 'workout', 'meal', 'nutrition', 'medical'],
  'education': ['course', 'student', 'lesson', 'quiz', 'grade', 'teacher', 'assignment', 'class', 'school'],
  'gaming': ['player', 'score', 'level', 'game', 'match', 'leaderboard', 'achievement', 'team', 'tournament'],
  'ai-ml': ['prompt', 'model', 'prediction', 'training', 'dataset', 'ai', 'ml', 'neural', 'classification'],
  'media': ['video', 'audio', 'image', 'file', 'upload', 'stream', 'playlist', 'album', 'gallery'],
  'communication': ['email', 'notification', 'sms', 'message', 'alert', 'newsletter', 'template'],
  'iot': ['device', 'sensor', 'reading', 'gateway', 'firmware', 'telemetry', 'automation'],
  'geolocation': ['location', 'map', 'route', 'place', 'address', 'geocode', 'weather', 'coordinate'],
  'auth': ['user', 'login', 'permission', 'role', 'token', 'session', 'oauth', 'identity'],
};

// Resource name synonyms/patterns
const RESOURCE_SYNONYMS = {
  'restaurant': ['menu', 'dish', 'reservation', 'table', 'order', 'review'],
  'hotel': ['room', 'booking', 'guest', 'amenity', 'review'],
  'school': ['student', 'teacher', 'course', 'class', 'grade', 'assignment'],
  'hospital': ['patient', 'doctor', 'appointment', 'prescription', 'department'],
  'gym': ['member', 'class', 'trainer', 'schedule', 'membership'],
  'library': ['book', 'member', 'loan', 'author', 'category'],
  'marketplace': ['product', 'seller', 'buyer', 'order', 'review', 'category'],
  'social_network': ['user', 'post', 'comment', 'like', 'follower', 'message'],
  'project_management': ['project', 'task', 'member', 'milestone', 'comment'],
  'crm': ['contact', 'deal', 'company', 'activity', 'pipeline', 'note'],
  'booking': ['service', 'appointment', 'provider', 'client', 'review'],
};


/**
 * Main AI generation function
 * Takes natural language and returns a complete API schema
 */
export function generateFromText(description) {
  if (!description || description.trim().length < 10) {
    throw new Error('Description too short. Please describe your API in at least a sentence.');
  }

  const normalized = description.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  // Step 1: Detect category
  const category = detectCategory(normalized);

  // Step 2: Extract resources
  const resources = extractResources(normalized, words);

  // Step 3: Generate API name
  const apiName = generateApiName(normalized, resources);

  // Step 4: Generate description
  const apiDescription = generateDescription(apiName, resources);

  // Step 5: Detect pricing suggestion
  const pricing = suggestPricing(resources, normalized);

  // Step 6: Generate tags
  const tags = generateTags(normalized, category, resources);

  return {
    name: apiName,
    description: apiDescription,
    category: category.id,
    version: '1.0.0',
    tags,
    resources: resources.map(r => ({
      name: capitalize(r.name),
      fields: r.fields,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })),
    pricing,
    _ai: {
      confidence: calculateConfidence(resources, normalized),
      detectedCategory: category,
      suggestedImprovements: getSuggestions(resources),
    },
  };
}

/**
 * Detect the most likely category from description
 */
function detectCategory(text) {
  let bestMatch = { id: 'general', score: 0 };

  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((sum, kw) => {
      return sum + (text.includes(kw) ? 1 : 0);
    }, 0);

    if (score > bestMatch.score) {
      bestMatch = { id: catId, score };
    }
  }

  const category = API_CATEGORIES.find(c => c.id === bestMatch.id);
  return category || API_CATEGORIES.find(c => c.id === 'general');
}

/**
 * Extract resources (entities) from the description
 */
function extractResources(text, words) {
  const resources = [];
  const foundResources = new Set();

  // Check known resource patterns
  for (const [domain, relatedResources] of Object.entries(RESOURCE_SYNONYMS)) {
    if (text.includes(domain) || text.includes(domain.replace('_', ' '))) {
      relatedResources.forEach(r => {
        if (!foundResources.has(r)) {
          foundResources.add(r);
          resources.push({
            name: r,
            fields: generateFieldsForResource(r, text),
          });
        }
      });
    }
  }

  // Extract nouns that look like resources
  const resourceIndicators = ['manage', 'track', 'list', 'create', 'store', 'api for', 'api de', 'with'];
  const potentialResources = [];

  resourceIndicators.forEach(indicator => {
    const idx = text.indexOf(indicator);
    if (idx !== -1) {
      const after = text.slice(idx + indicator.length).trim();
      const nextWords = after.split(/[\s,]+/).slice(0, 5);
      nextWords.forEach(word => {
        const cleaned = word.replace(/[^a-z]/g, '');
        if (cleaned.length > 2 && !isStopWord(cleaned) && !foundResources.has(cleaned)) {
          potentialResources.push(cleaned);
        }
      });
    }
  });

  // Add detected nouns as resources
  potentialResources.slice(0, 5).forEach(name => {
    if (!foundResources.has(name)) {
      foundResources.add(name);
      resources.push({
        name: singularize(name),
        fields: generateFieldsForResource(name, text),
      });
    }
  });

  // Ensure at least one resource
  if (resources.length === 0) {
    const mainWord = words.find(w => w.length > 3 && !isStopWord(w)) || 'item';
    resources.push({
      name: singularize(mainWord),
      fields: generateFieldsForResource(mainWord, text),
    });
  }

  return resources.slice(0, 6); // Max 6 resources
}


/**
 * Generate fields for a resource based on its name and context
 */
function generateFieldsForResource(resourceName, context) {
  const fields = [];
  const name = resourceName.toLowerCase();

  // Always add a name/title field
  if (['product', 'item', 'service', 'course', 'event', 'project', 'task'].some(w => name.includes(w))) {
    fields.push({ name: 'title', type: 'string', required: true });
  } else {
    fields.push({ name: 'name', type: 'string', required: true });
  }

  // Context-based field detection
  const contextFields = [];

  // Check if price-related
  if (context.includes('price') || context.includes('cost') || context.includes('paid') || 
      ['product', 'service', 'item', 'plan', 'subscription', 'ticket'].some(w => name.includes(w))) {
    contextFields.push({ name: 'price', type: 'number', required: true, min: 0 });
  }

  // Check if description needed
  if (!['tag', 'category', 'like', 'follow'].some(w => name.includes(w))) {
    contextFields.push({ name: 'description', type: 'string' });
  }

  // Type/category field for most resources
  if (['product', 'item', 'service', 'event', 'content', 'post'].some(w => name.includes(w))) {
    contextFields.push({ name: 'category', type: 'string' });
  }

  // Status field
  if (!['review', 'comment', 'like', 'tag'].some(w => name.includes(w))) {
    contextFields.push({ name: 'status', type: 'string', enum: ['active', 'inactive', 'pending'], default: 'active' });
  }

  // Image for visual resources
  if (['product', 'user', 'profile', 'item', 'post', 'event', 'place', 'property'].some(w => name.includes(w))) {
    contextFields.push({ name: 'image', type: 'url' });
  }

  // Rating for reviewable items
  if (['product', 'service', 'restaurant', 'hotel', 'course', 'book', 'movie'].some(w => name.includes(w))) {
    contextFields.push({ name: 'rating', type: 'number', min: 0, max: 5 });
  }

  // Location for physical things
  if (context.includes('location') || context.includes('address') || context.includes('map') ||
      ['restaurant', 'hotel', 'store', 'property', 'place', 'venue'].some(w => name.includes(w))) {
    contextFields.push({ name: 'address', type: 'string' });
    contextFields.push({ name: 'latitude', type: 'number' });
    contextFields.push({ name: 'longitude', type: 'number' });
  }

  // Contact info for people/businesses
  if (['user', 'contact', 'customer', 'client', 'member', 'employee', 'patient', 'doctor'].some(w => name.includes(w))) {
    contextFields.push({ name: 'email', type: 'email', required: true });
    contextFields.push({ name: 'phone', type: 'string' });
  }

  // Date fields for time-based resources
  if (['event', 'appointment', 'booking', 'reservation', 'task', 'deadline'].some(w => name.includes(w))) {
    contextFields.push({ name: 'startDate', type: 'date', required: true });
    contextFields.push({ name: 'endDate', type: 'date' });
  }

  // Quantity for inventory
  if (['product', 'item', 'stock', 'inventory'].some(w => name.includes(w))) {
    contextFields.push({ name: 'quantity', type: 'integer', default: 0, min: 0 });
  }

  // Tags for categorizable items
  if (!['tag', 'category'].some(w => name.includes(w))) {
    contextFields.push({ name: 'tags', type: 'array' });
  }

  // Combine and limit
  fields.push(...contextFields);

  // Add any field names mentioned directly in context
  for (const [fieldName, fieldDef] of Object.entries(FIELD_PATTERNS)) {
    if (context.includes(fieldName) && !fields.some(f => f.name === fieldName)) {
      fields.push({ name: fieldName, ...fieldDef });
    }
  }

  return fields.slice(0, 15); // Max 15 fields per resource
}

/**
 * Generate a nice API name from the description
 */
function generateApiName(text, resources) {
  // Try to find a domain/business name
  const patterns = [
    /(?:api (?:for|de|para) )(.+?)(?:\s+(?:with|con|que))/i,
    /(?:api (?:for|de|para) )(.+)/i,
    /(.+?)(?:\s+api)/i,
    /(?:quiero|want|need|create|build)\s+(?:una?\s+)?(.+?)(?:\s+(?:api|with|con))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim()
        .split(/\s+/).slice(0, 4).join(' ');
      return capitalize(name);
    }
  }

  // Fallback: use first resource name
  if (resources.length > 0) {
    return capitalize(resources[0].name) + ' Manager';
  }

  return 'Custom API';
}

/**
 * Generate API description
 */
function generateDescription(name, resources) {
  const resourceNames = resources.map(r => capitalize(r.name)).join(', ');
  const endpointCount = resources.length * 4; // CRUD
  return `Complete REST API for ${name}. Manage ${resourceNames} with ${endpointCount} auto-generated endpoints including CRUD operations, pagination, filtering, and validation.`;
}


/**
 * Suggest pricing based on complexity
 */
function suggestPricing(resources, text) {
  const complexity = resources.reduce((sum, r) => sum + r.fields.length, 0);

  if (text.includes('free') || text.includes('gratis')) {
    return { model: 'free' };
  }

  if (complexity > 20) {
    return { model: 'paid', perRequest: 0.002, monthly: 19.99 };
  } else if (complexity > 10) {
    return { model: 'freemium', perRequest: 0.001, monthly: 9.99 };
  }

  return { model: 'free' };
}

/**
 * Generate relevant tags
 */
function generateTags(text, category, resources) {
  const tags = new Set();
  tags.add(category.id);

  resources.forEach(r => tags.add(r.name.toLowerCase()));

  // Add contextual tags
  const tagKeywords = ['rest', 'crud', 'api', 'realtime', 'mobile', 'web'];
  tagKeywords.forEach(kw => {
    if (text.includes(kw)) tags.add(kw);
  });

  return [...tags].slice(0, 8);
}

/**
 * Calculate AI confidence score
 */
function calculateConfidence(resources, text) {
  let confidence = 0.5; // Base

  // More context = more confidence
  if (text.length > 100) confidence += 0.1;
  if (text.length > 200) confidence += 0.1;

  // Known patterns detected
  if (resources.length > 1) confidence += 0.1;
  if (resources.every(r => r.fields.length > 3)) confidence += 0.1;

  // Cap at 0.95
  return Math.min(0.95, Math.round(confidence * 100) / 100);
}

/**
 * Get improvement suggestions
 */
function getSuggestions(resources) {
  const suggestions = [];

  if (resources.length === 1) {
    suggestions.push('Consider adding related resources for a more complete API');
  }

  resources.forEach(r => {
    if (r.fields.length < 4) {
      suggestions.push(`Add more fields to "${r.name}" for a richer data model`);
    }
  });

  if (resources.length > 4) {
    suggestions.push('Consider splitting into multiple APIs for better organization');
  }

  return suggestions;
}

// ============ Utility Functions ============

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') || word.endsWith('xes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function isStopWord(word) {
  const stops = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'that',
    'this', 'these', 'those', 'api', 'want', 'quiero', 'una', 'con',
    'que', 'para', 'como', 'create', 'make', 'build', 'get', 'manage',
  ]);
  return stops.has(word);
}
