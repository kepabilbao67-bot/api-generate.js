/**
 * APIForge Core Engine
 * 
 * The heart of the platform - takes a schema definition and generates
 * a fully functional API with endpoints, validation, and documentation.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../utils/database.js';
import { generateEndpoints } from './endpoint-generator.js';
import { generateValidation } from './validation-generator.js';
import { generateDocs } from './docs-generator.js';

export class APIEngine {
  constructor() {
    this.supportedTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'date', 'email', 'url', 'uuid'];
    this.supportedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  }

  /**
   * Generate a complete API from a schema definition
   */
  async generate(schema, ownerId) {
    // Validate the schema
    const validated = this.validateSchema(schema);
    if (!validated.valid) {
      throw new Error(`Invalid schema: ${validated.errors.join(', ')}`);
    }

    const apiId = uuidv4();
    const slug = this.generateSlug(schema.name);

    // Generate all components
    const endpoints = generateEndpoints(schema);
    const validation = generateValidation(schema);
    const documentation = generateDocs(schema, endpoints);

    // Build the generated API code
    const generatedCode = this.buildAPICode(schema, endpoints, validation);

    // Store in database
    const api = {
      id: apiId,
      owner_id: ownerId,
      name: schema.name,
      slug,
      description: schema.description || '',
      category: schema.category || 'general',
      version: schema.version || '1.0.0',
      status: 'active',
      visibility: schema.visibility || 'public',
      pricing_model: schema.pricing?.model || 'free',
      price_per_request: schema.pricing?.perRequest || 0,
      monthly_price: schema.pricing?.monthly || 0,
      rate_limit: schema.rateLimit || 100,
      schema_definition: JSON.stringify(schema),
      generated_code: JSON.stringify(generatedCode),
      endpoints_count: endpoints.length,
      tags: JSON.stringify(schema.tags || []),
      documentation: JSON.stringify(documentation),
    };

    db.prepare(`
      INSERT INTO apis (id, owner_id, name, slug, description, category, version, status, visibility, pricing_model, price_per_request, monthly_price, rate_limit, schema_definition, generated_code, endpoints_count, tags, documentation)
      VALUES (@id, @owner_id, @name, @slug, @description, @category, @version, @status, @visibility, @pricing_model, @price_per_request, @monthly_price, @rate_limit, @schema_definition, @generated_code, @endpoints_count, @tags, @documentation)
    `).run(api);

    return {
      id: apiId,
      slug,
      name: schema.name,
      endpoints,
      documentation,
      baseUrl: `/api/v1/live/${slug}`,
      status: 'active',
    };
  }


  /**
   * Validate a schema definition
   */
  validateSchema(schema) {
    const errors = [];

    if (!schema.name || typeof schema.name !== 'string') {
      errors.push('API name is required and must be a string');
    }

    if (!schema.resources || !Array.isArray(schema.resources) || schema.resources.length === 0) {
      errors.push('At least one resource is required');
    }

    if (schema.resources) {
      schema.resources.forEach((resource, idx) => {
        if (!resource.name) errors.push(`Resource ${idx} must have a name`);
        if (!resource.fields || !Array.isArray(resource.fields)) {
          errors.push(`Resource "${resource.name}" must have fields array`);
        }
        if (resource.fields) {
          resource.fields.forEach((field, fIdx) => {
            if (!field.name) errors.push(`Field ${fIdx} in "${resource.name}" must have a name`);
            if (!field.type || !this.supportedTypes.includes(field.type)) {
              errors.push(`Field "${field.name}" has invalid type. Supported: ${this.supportedTypes.join(', ')}`);
            }
          });
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate URL-friendly slug
   */
  generateSlug(name) {
    const base = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check uniqueness
    const existing = db.prepare('SELECT id FROM apis WHERE slug = ?').get(base);
    if (existing) {
      return `${base}-${uuidv4().slice(0, 8)}`;
    }
    return base;
  }


  /**
   * Build the complete API code from components
   */
  buildAPICode(schema, endpoints, validation) {
    const code = {
      routes: [],
      handlers: {},
      middleware: [],
    };

    schema.resources.forEach(resource => {
      const resourceName = resource.name.toLowerCase();
      const methods = resource.methods || ['GET', 'POST', 'PUT', 'DELETE'];

      methods.forEach(method => {
        const endpoint = this.buildEndpoint(method, resource);
        code.routes.push(endpoint.route);
        code.handlers[endpoint.handlerName] = endpoint.handler;
      });
    });

    return code;
  }

  /**
   * Build individual endpoint
   */
  buildEndpoint(method, resource) {
    const name = resource.name.toLowerCase();
    const plural = name.endsWith('s') ? name : `${name}s`;

    const endpoints = {
      GET: {
        route: { method: 'GET', path: `/${plural}`, handler: `list${resource.name}` },
        handlerName: `list${resource.name}`,
        handler: { type: 'list', resource: name, fields: resource.fields },
      },
      POST: {
        route: { method: 'POST', path: `/${plural}`, handler: `create${resource.name}` },
        handlerName: `create${resource.name}`,
        handler: { type: 'create', resource: name, fields: resource.fields, validation: true },
      },
      PUT: {
        route: { method: 'PUT', path: `/${plural}/:id`, handler: `update${resource.name}` },
        handlerName: `update${resource.name}`,
        handler: { type: 'update', resource: name, fields: resource.fields, validation: true },
      },
      DELETE: {
        route: { method: 'DELETE', path: `/${plural}/:id`, handler: `delete${resource.name}` },
        handlerName: `delete${resource.name}`,
        handler: { type: 'delete', resource: name },
      },
    };

    return endpoints[method] || endpoints.GET;
  }

  /**
   * Execute a live API request against a generated API
   */
  executeRequest(apiSlug, method, path, body, queryParams) {
    const api = db.prepare('SELECT * FROM apis WHERE slug = ? AND status = ?').get(apiSlug, 'active');
    if (!api) {
      throw new Error('API not found or inactive');
    }

    const schema = JSON.parse(api.schema_definition);
    const generatedCode = JSON.parse(api.generated_code);

    // Find matching route
    const matchedRoute = this.matchRoute(generatedCode.routes, method, path);
    if (!matchedRoute) {
      throw new Error(`No endpoint found: ${method} ${path}`);
    }

    // Execute the handler
    const handler = generatedCode.handlers[matchedRoute.handler];
    return this.executeHandler(handler, body, queryParams, matchedRoute.params);
  }


  /**
   * Match incoming request to a route
   */
  matchRoute(routes, method, path) {
    for (const route of routes) {
      if (route.method !== method) continue;

      const routeParts = route.path.split('/').filter(Boolean);
      const pathParts = path.split('/').filter(Boolean);

      if (routeParts.length !== pathParts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return { ...route, params };
      }
    }
    return null;
  }

  /**
   * Execute a handler (in-memory data store for generated APIs)
   */
  executeHandler(handler, body, query, params) {
    const storageKey = `api_data_${handler.resource}`;

    // Get or initialize storage
    let storage = this.getStorage(storageKey);

    switch (handler.type) {
      case 'list': {
        let results = [...storage];
        // Apply pagination
        const page = parseInt(query?.page) || 1;
        const limit = parseInt(query?.limit) || 20;
        const offset = (page - 1) * limit;
        // Apply filtering
        if (query?.filter) {
          try {
            const filters = JSON.parse(query.filter);
            results = results.filter(item =>
              Object.entries(filters).every(([key, val]) => item[key] == val)
            );
          } catch (e) { /* ignore invalid filter */ }
        }
        // Apply sorting
        if (query?.sort) {
          const [field, order] = query.sort.split(':');
          results.sort((a, b) => {
            if (order === 'desc') return b[field] > a[field] ? 1 : -1;
            return a[field] > b[field] ? 1 : -1;
          });
        }
        const total = results.length;
        results = results.slice(offset, offset + limit);
        return {
          data: results,
          meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
      }

      case 'create': {
        const newItem = {
          id: uuidv4(),
          ...body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        storage.push(newItem);
        this.setStorage(storageKey, storage);
        return { data: newItem, status: 201 };
      }

      case 'update': {
        const idx = storage.findIndex(item => item.id === params.id);
        if (idx === -1) throw new Error('Resource not found');
        storage[idx] = { ...storage[idx], ...body, updated_at: new Date().toISOString() };
        this.setStorage(storageKey, storage);
        return { data: storage[idx] };
      }

      case 'delete': {
        const deleteIdx = storage.findIndex(item => item.id === params.id);
        if (deleteIdx === -1) throw new Error('Resource not found');
        const deleted = storage.splice(deleteIdx, 1)[0];
        this.setStorage(storageKey, storage);
        return { data: deleted, message: 'Deleted successfully' };
      }

      default:
        throw new Error(`Unknown handler type: ${handler.type}`);
    }
  }

  /**
   * Simple in-memory + DB storage for API data
   */
  getStorage(key) {
    if (!this._storage) this._storage = {};
    if (!this._storage[key]) {
      this._storage[key] = [];
    }
    return this._storage[key];
  }

  setStorage(key, data) {
    if (!this._storage) this._storage = {};
    this._storage[key] = data;
  }
}

export default new APIEngine();
