/**
 * Documentation Generator
 * Auto-generates OpenAPI 3.0 spec from schema definitions
 */

import { config } from '../config/index.js';

export function generateDocs(schema, endpoints) {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: schema.name,
      description: schema.description || `Auto-generated API for ${schema.name}`,
      version: schema.version || '1.0.0',
      contact: { name: 'APIForge', url: config.seo.siteUrl },
    },
    servers: [
      { url: `${config.baseUrl}/api/v1/live/${generateSlugSimple(schema.name)}`, description: 'Live server' },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  };

  // Generate component schemas
  schema.resources.forEach(resource => {
    openApiSpec.components.schemas[resource.name] = {
      type: 'object',
      properties: buildSchemaProperties(resource.fields),
      required: resource.fields.filter(f => f.required).map(f => f.name),
    };
  });

  // Generate paths from endpoints
  endpoints.forEach(endpoint => {
    const path = endpoint.path.replace(/:(\w+)/g, '{$1}');
    if (!openApiSpec.paths[path]) {
      openApiSpec.paths[path] = {};
    }

    openApiSpec.paths[path][endpoint.method.toLowerCase()] = {
      summary: endpoint.description,
      operationId: `${endpoint.method.toLowerCase()}${path.replace(/[/{}-]/g, '_')}`,
      parameters: (endpoint.parameters || []).map(p => ({
        name: p.name,
        in: p.in,
        required: p.required || false,
        schema: { type: p.type || 'string' },
        description: p.description || '',
      })),
      ...(endpoint.body && {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: buildSchemaProperties(endpoint.body),
              },
            },
          },
        },
      }),
      responses: {
        200: {
          description: 'Successful response',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        400: { description: 'Bad request' },
        401: { description: 'Unauthorized' },
        404: { description: 'Not found' },
        429: { description: 'Rate limit exceeded' },
      },
    };
  });

  return openApiSpec;
}

function buildSchemaProperties(fields) {
  const properties = {};
  fields.forEach(field => {
    properties[field.name] = {
      type: mapToOpenApiType(field.type),
      ...(field.description && { description: field.description }),
      ...(field.enum && { enum: field.enum }),
      ...(field.default !== undefined && { default: field.default }),
      ...(field.example && { example: field.example }),
    };
  });
  return properties;
}

function mapToOpenApiType(type) {
  const map = {
    string: 'string',
    number: 'number',
    integer: 'integer',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
    date: 'string',
    email: 'string',
    url: 'string',
    uuid: 'string',
  };
  return map[type] || 'string';
}

function generateSlugSimple(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
