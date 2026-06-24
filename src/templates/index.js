/**
 * API Templates - Pre-built schemas users can deploy in 1 click
 * These are the "Shopify themes" of APIForge
 */

export const API_TEMPLATES = [
  {
    id: 'ecommerce-products',
    name: 'E-Commerce Products API',
    description: 'Complete product catalog with categories, reviews, and inventory management',
    category: 'ecommerce',
    icon: '🛍️',
    popularity: 95,
    tags: ['products', 'inventory', 'reviews', 'categories'],
    schema: {
      name: 'E-Commerce Products',
      description: 'Full-featured product catalog API with categories, reviews, and stock management',
      category: 'ecommerce',
      tags: ['ecommerce', 'products', 'inventory'],
      resources: [
        {
          name: 'Product',
          fields: [
            { name: 'title', type: 'string', required: true, description: 'Product name' },
            { name: 'description', type: 'string', description: 'Product description' },
            { name: 'price', type: 'number', required: true, min: 0 },
            { name: 'compareAtPrice', type: 'number', description: 'Original price for sales' },
            { name: 'sku', type: 'string', required: true },
            { name: 'category', type: 'string', required: true },
            { name: 'brand', type: 'string' },
            { name: 'images', type: 'array', description: 'Image URLs' },
            { name: 'inStock', type: 'boolean', default: true },
            { name: 'stockQuantity', type: 'integer', default: 0 },
            { name: 'weight', type: 'number' },
            { name: 'tags', type: 'array' },
            { name: 'rating', type: 'number', min: 0, max: 5 },
          ],
        },
        {
          name: 'Category',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
            { name: 'description', type: 'string' },
            { name: 'parentId', type: 'string' },
            { name: 'image', type: 'url' },
            { name: 'productCount', type: 'integer', default: 0 },
          ],
        },
        {
          name: 'Review',
          fields: [
            { name: 'productId', type: 'string', required: true },
            { name: 'author', type: 'string', required: true },
            { name: 'rating', type: 'integer', required: true, min: 1, max: 5 },
            { name: 'title', type: 'string' },
            { name: 'comment', type: 'string' },
            { name: 'verified', type: 'boolean', default: false },
          ],
        },
      ],
    },
  },
  {
    id: 'saas-users',
    name: 'SaaS User Management API',
    description: 'User accounts, teams, roles, permissions, and activity tracking',
    category: 'auth',
    icon: '👥',
    popularity: 90,
    tags: ['users', 'teams', 'roles', 'permissions'],
    schema: {
      name: 'SaaS Users',
      description: 'Complete user management with teams, roles, and activity tracking',
      category: 'auth',
      tags: ['saas', 'users', 'teams', 'rbac'],
      resources: [
        {
          name: 'User',
          fields: [
            { name: 'email', type: 'email', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'avatar', type: 'url' },
            { name: 'role', type: 'string', enum: ['admin', 'member', 'viewer'], default: 'member' },
            { name: 'teamId', type: 'string' },
            { name: 'isActive', type: 'boolean', default: true },
            { name: 'lastLoginAt', type: 'date' },
            { name: 'preferences', type: 'object' },
          ],
        },
        {
          name: 'Team',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
            { name: 'ownerId', type: 'string', required: true },
            { name: 'memberCount', type: 'integer', default: 1 },
            { name: 'plan', type: 'string', enum: ['free', 'pro', 'enterprise'], default: 'free' },
            { name: 'settings', type: 'object' },
          ],
        },
        {
          name: 'Activity',
          fields: [
            { name: 'userId', type: 'string', required: true },
            { name: 'action', type: 'string', required: true },
            { name: 'resource', type: 'string' },
            { name: 'details', type: 'object' },
            { name: 'ipAddress', type: 'string' },
          ],
        },
      ],
    },
  },
  {
    id: 'blog-cms',
    name: 'Blog & CMS API',
    description: 'Content management with posts, categories, comments, and media',
    category: 'social',
    icon: '📝',
    popularity: 88,
    tags: ['blog', 'cms', 'posts', 'comments', 'media'],
    schema: {
      name: 'Blog CMS',
      description: 'Headless CMS API for blogs with posts, categories, tags, and comments',
      category: 'social',
      tags: ['blog', 'cms', 'content', 'headless'],
      resources: [
        {
          name: 'Post',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'excerpt', type: 'string' },
            { name: 'author', type: 'string', required: true },
            { name: 'category', type: 'string' },
            { name: 'tags', type: 'array' },
            { name: 'featuredImage', type: 'url' },
            { name: 'status', type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' },
            { name: 'publishedAt', type: 'date' },
            { name: 'readTime', type: 'integer' },
            { name: 'views', type: 'integer', default: 0 },
          ],
        },
        {
          name: 'Comment',
          fields: [
            { name: 'postId', type: 'string', required: true },
            { name: 'author', type: 'string', required: true },
            { name: 'email', type: 'email' },
            { name: 'content', type: 'string', required: true },
            { name: 'parentId', type: 'string' },
            { name: 'isApproved', type: 'boolean', default: false },
            { name: 'likes', type: 'integer', default: 0 },
          ],
        },
        {
          name: 'Media',
          fields: [
            { name: 'filename', type: 'string', required: true },
            { name: 'url', type: 'url', required: true },
            { name: 'mimeType', type: 'string' },
            { name: 'size', type: 'integer' },
            { name: 'alt', type: 'string' },
            { name: 'caption', type: 'string' },
          ],
        },
      ],
    },
  },
  {
    id: 'fitness-tracker',
    name: 'Fitness Tracker API',
    description: 'Workouts, exercises, progress tracking, and meal plans',
    category: 'health',
    icon: '💪',
    popularity: 82,
    tags: ['fitness', 'workouts', 'health', 'nutrition'],
    schema: {
      name: 'Fitness Tracker',
      description: 'Complete fitness API for workouts, exercises, and nutrition tracking',
      category: 'health',
      tags: ['fitness', 'workout', 'health', 'nutrition'],
      resources: [
        {
          name: 'Workout',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'type', type: 'string', enum: ['strength', 'cardio', 'flexibility', 'hiit', 'yoga'], required: true },
            { name: 'duration', type: 'integer', description: 'Duration in minutes' },
            { name: 'caloriesBurned', type: 'integer' },
            { name: 'difficulty', type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
            { name: 'exercises', type: 'array' },
            { name: 'notes', type: 'string' },
            { name: 'completedAt', type: 'date' },
          ],
        },
        {
          name: 'Exercise',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'muscleGroup', type: 'string', required: true },
            { name: 'sets', type: 'integer' },
            { name: 'reps', type: 'integer' },
            { name: 'weight', type: 'number' },
            { name: 'duration', type: 'integer' },
            { name: 'instructions', type: 'string' },
            { name: 'videoUrl', type: 'url' },
          ],
        },
        {
          name: 'Meal',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'type', type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
            { name: 'calories', type: 'integer' },
            { name: 'protein', type: 'number' },
            { name: 'carbs', type: 'number' },
            { name: 'fat', type: 'number' },
            { name: 'ingredients', type: 'array' },
            { name: 'recipe', type: 'string' },
          ],
        },
      ],
    },
  },
  {
    id: 'real-estate',
    name: 'Real Estate Listings API',
    description: 'Property listings, agents, appointments, and valuations',
    category: 'ecommerce',
    icon: '🏠',
    popularity: 78,
    tags: ['real-estate', 'properties', 'listings', 'agents'],
    schema: {
      name: 'Real Estate',
      description: 'Property listing and management API',
      category: 'ecommerce',
      tags: ['real-estate', 'properties', 'housing'],
      resources: [
        {
          name: 'Property',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'type', type: 'string', enum: ['house', 'apartment', 'condo', 'land', 'commercial'], required: true },
            { name: 'status', type: 'string', enum: ['for-sale', 'for-rent', 'sold', 'rented'], default: 'for-sale' },
            { name: 'price', type: 'number', required: true },
            { name: 'address', type: 'string', required: true },
            { name: 'city', type: 'string', required: true },
            { name: 'zipCode', type: 'string' },
            { name: 'bedrooms', type: 'integer' },
            { name: 'bathrooms', type: 'integer' },
            { name: 'area', type: 'number', description: 'Square meters' },
            { name: 'images', type: 'array' },
            { name: 'features', type: 'array' },
            { name: 'agentId', type: 'string' },
            { name: 'latitude', type: 'number' },
            { name: 'longitude', type: 'number' },
          ],
        },
        {
          name: 'Agent',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'email', required: true },
            { name: 'phone', type: 'string' },
            { name: 'photo', type: 'url' },
            { name: 'agency', type: 'string' },
            { name: 'license', type: 'string' },
            { name: 'rating', type: 'number', min: 0, max: 5 },
            { name: 'propertiesSold', type: 'integer', default: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'crypto-portfolio',
    name: 'Crypto Portfolio API',
    description: 'Track crypto assets, transactions, and P&L calculations',
    category: 'finance',
    icon: '₿',
    popularity: 85,
    tags: ['crypto', 'portfolio', 'finance', 'trading'],
    schema: {
      name: 'Crypto Portfolio',
      description: 'Cryptocurrency portfolio tracking with transactions and P&L',
      category: 'finance',
      tags: ['crypto', 'portfolio', 'trading', 'finance'],
      resources: [
        {
          name: 'Asset',
          fields: [
            { name: 'symbol', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'quantity', type: 'number', required: true },
            { name: 'avgBuyPrice', type: 'number', required: true },
            { name: 'currentPrice', type: 'number' },
            { name: 'totalInvested', type: 'number' },
            { name: 'pnl', type: 'number' },
            { name: 'pnlPercentage', type: 'number' },
            { name: 'wallet', type: 'string', enum: ['exchange', 'cold-wallet', 'defi'] },
          ],
        },
        {
          name: 'Transaction',
          fields: [
            { name: 'symbol', type: 'string', required: true },
            { name: 'type', type: 'string', enum: ['buy', 'sell', 'transfer', 'stake', 'reward'], required: true },
            { name: 'quantity', type: 'number', required: true },
            { name: 'price', type: 'number', required: true },
            { name: 'total', type: 'number' },
            { name: 'fee', type: 'number', default: 0 },
            { name: 'exchange', type: 'string' },
            { name: 'notes', type: 'string' },
            { name: 'txHash', type: 'string' },
          ],
        },
      ],
    },
  },
  {
    id: 'event-management',
    name: 'Event Management API',
    description: 'Events, tickets, attendees, and check-in management',
    category: 'general',
    icon: '🎫',
    popularity: 75,
    tags: ['events', 'tickets', 'attendees', 'bookings'],
    schema: {
      name: 'Event Manager',
      description: 'Complete event management with ticketing and attendee tracking',
      category: 'general',
      tags: ['events', 'tickets', 'bookings'],
      resources: [
        {
          name: 'Event',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'description', type: 'string' },
            { name: 'venue', type: 'string', required: true },
            { name: 'startDate', type: 'date', required: true },
            { name: 'endDate', type: 'date' },
            { name: 'capacity', type: 'integer' },
            { name: 'ticketsSold', type: 'integer', default: 0 },
            { name: 'price', type: 'number', default: 0 },
            { name: 'category', type: 'string', enum: ['conference', 'workshop', 'concert', 'meetup', 'webinar'] },
            { name: 'isOnline', type: 'boolean', default: false },
            { name: 'streamUrl', type: 'url' },
            { name: 'image', type: 'url' },
            { name: 'status', type: 'string', enum: ['upcoming', 'live', 'completed', 'cancelled'], default: 'upcoming' },
          ],
        },
        {
          name: 'Ticket',
          fields: [
            { name: 'eventId', type: 'string', required: true },
            { name: 'attendeeName', type: 'string', required: true },
            { name: 'attendeeEmail', type: 'email', required: true },
            { name: 'type', type: 'string', enum: ['general', 'vip', 'early-bird'], default: 'general' },
            { name: 'price', type: 'number' },
            { name: 'qrCode', type: 'string' },
            { name: 'checkedIn', type: 'boolean', default: false },
            { name: 'checkedInAt', type: 'date' },
          ],
        },
      ],
    },
  },
  {
    id: 'ai-prompts',
    name: 'AI Prompts Library API',
    description: 'Store, categorize, and share AI prompts with version history',
    category: 'ai-ml',
    icon: '🤖',
    popularity: 92,
    tags: ['ai', 'prompts', 'chatgpt', 'templates'],
    schema: {
      name: 'AI Prompts',
      description: 'AI prompt library with categorization, ratings, and version history',
      category: 'ai-ml',
      tags: ['ai', 'prompts', 'gpt', 'templates'],
      resources: [
        {
          name: 'Prompt',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'category', type: 'string', enum: ['writing', 'coding', 'marketing', 'design', 'business', 'education'], required: true },
            { name: 'model', type: 'string', enum: ['gpt-4', 'gpt-3.5', 'claude', 'gemini', 'any'], default: 'any' },
            { name: 'variables', type: 'array', description: 'Template variables like {{topic}}' },
            { name: 'author', type: 'string' },
            { name: 'rating', type: 'number', min: 0, max: 5 },
            { name: 'usageCount', type: 'integer', default: 0 },
            { name: 'tags', type: 'array' },
            { name: 'isPublic', type: 'boolean', default: true },
            { name: 'version', type: 'integer', default: 1 },
          ],
        },
        {
          name: 'Collection',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'description', type: 'string' },
            { name: 'promptIds', type: 'array' },
            { name: 'isPublic', type: 'boolean', default: false },
            { name: 'followers', type: 'integer', default: 0 },
          ],
        },
      ],
    },
  },
];

/**
 * Get all templates
 */
export function getAllTemplates() {
  return API_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    icon: t.icon,
    popularity: t.popularity,
    tags: t.tags,
    resourceCount: t.schema.resources.length,
    fieldCount: t.schema.resources.reduce((sum, r) => sum + r.fields.length, 0),
  }));
}

/**
 * Get template by ID
 */
export function getTemplateById(id) {
  return API_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category) {
  return API_TEMPLATES.filter(t => t.category === category);
}
