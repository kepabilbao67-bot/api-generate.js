/**
 * Predefined API Categories for the Marketplace
 */

export const API_CATEGORIES = [
  {
    id: 'ai-ml',
    name: 'AI & Machine Learning',
    icon: '🤖',
    description: 'Text generation, image recognition, NLP, predictions',
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    icon: '📊',
    description: 'Data processing, aggregation, reporting APIs',
  },
  {
    id: 'finance',
    name: 'Finance & Payments',
    icon: '💰',
    description: 'Currency exchange, crypto, stock data, invoicing',
  },
  {
    id: 'communication',
    name: 'Communication',
    icon: '📱',
    description: 'Email, SMS, push notifications, chat',
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    icon: '🛒',
    description: 'Products, orders, inventory, shipping',
  },
  {
    id: 'social',
    name: 'Social & Content',
    icon: '🌐',
    description: 'Social media, content management, feeds',
  },
  {
    id: 'geolocation',
    name: 'Geolocation & Maps',
    icon: '🗺️',
    description: 'Geocoding, routing, place search, weather',
  },
  {
    id: 'media',
    name: 'Media & Files',
    icon: '🎬',
    description: 'Image processing, video, file conversion',
  },
  {
    id: 'auth',
    name: 'Authentication & Security',
    icon: '🔐',
    description: 'OAuth, identity verification, encryption',
  },
  {
    id: 'iot',
    name: 'IoT & Hardware',
    icon: '📡',
    description: 'Device management, sensor data, automation',
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    icon: '🏥',
    description: 'Health records, fitness tracking, nutrition',
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    description: 'Courses, quizzes, learning management',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: '🎮',
    description: 'Leaderboards, matchmaking, game state',
  },
  {
    id: 'general',
    name: 'General Purpose',
    icon: '⚡',
    description: 'Utility APIs, tools, and miscellaneous',
  },
];

export function getCategoryById(id) {
  return API_CATEGORIES.find(c => c.id === id) || API_CATEGORIES.at(-1);
}

export function validateCategory(id) {
  return API_CATEGORIES.some(c => c.id === id);
}
