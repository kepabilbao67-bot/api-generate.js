/**
 * Import/Export System
 * Import from OpenAPI/Swagger specs
 * Export to OpenAPI, Postman, or raw schema
 */

/**
 * Import an OpenAPI spec and convert to APIForge schema
 */
export function importFromOpenAPI(openApiSpec) {
  if (!openApiSpec || !openApiSpec.paths) {
    throw new Error('Invalid OpenAPI spec: missing paths');
  }

  const info = openApiSpec.info || {};
  const schemas = openApiSpec.components?.schemas || {};

  // Extract resources from schemas
  const resources = [];

  for (const [name, schema] of Object.entries(schemas)) {
    if (schema.type !== 'object') continue;

    const fields = [];
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties || {})) {
      fields.push({
        name: fieldName,
        type: mapOpenApiType(fieldSchema),
        required: required.includes(fieldName),
        ...(fieldSchema.description && { description: fieldSchema.description }),
        ...(fieldSchema.enum && { enum: fieldSchema.enum }),
        ...(fieldSchema.default !== undefined && { default: fieldSchema.default }),
        ...(fieldSchema.minimum !== undefined && { min: fieldSchema.minimum }),
        ...(fieldSchema.maximum !== undefined && { max: fieldSchema.maximum }),
      });
    }

    resources.push({ name, fields });
  }

  // If no schemas, try to extract from paths
  if (resources.length === 0) {
    const resourceNames = new Set();
    for (const path of Object.keys(openApiSpec.paths)) {
      const parts = path.split('/').filter(Boolean);
      const resourcePart = parts.find(p => !p.startsWith('{'));
      if (resourcePart) resourceNames.add(resourcePart);
    }

    resourceNames.forEach(name => {
      resources.push({
        name: capitalize(singularize(name)),
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'description', type: 'string' },
          { name: 'status', type: 'string', default: 'active' },
        ],
      });
    });
  }

  return {
    name: info.title || 'Imported API',
    description: info.description || '',
    version: info.version || '1.0.0',
    category: 'general',
    resources,
    _import: {
      source: 'openapi',
      originalVersion: openApiSpec.openapi || '3.0.0',
      schemasImported: Object.keys(schemas).length,
      pathsDetected: Object.keys(openApiSpec.paths).length,
    },
  };
}


/**
 * Export APIForge schema as OpenAPI 3.0 spec
 */
export function exportToOpenAPI(api) {
  const schema = typeof api.schema_definition === 'string' 
    ? JSON.parse(api.schema_definition) : api.schema_definition;

  const spec = {
    openapi: '3.0.3',
    info: {
      title: api.name,
      description: api.description,
      version: api.version || '1.0.0',
    },
    paths: {},
    components: { schemas: {} },
  };

  (schema.resources || []).forEach(resource => {
    const name = resource.name;
    const lower = name.toLowerCase();
    const plural = lower.endsWith('s') ? lower : `${lower}s`;

    // Add to component schemas
    spec.components.schemas[name] = {
      type: 'object',
      properties: {},
      required: [],
    };

    resource.fields.forEach(field => {
      spec.components.schemas[name].properties[field.name] = {
        type: mapToSpecType(field.type),
        ...(field.description && { description: field.description }),
        ...(field.enum && { enum: field.enum }),
      };
      if (field.required) spec.components.schemas[name].required.push(field.name);
    });

    // Add paths
    spec.paths[`/${plural}`] = {
      get: { summary: `List ${plural}`, responses: { 200: { description: 'Success' } } },
      post: { summary: `Create ${lower}`, responses: { 201: { description: 'Created' } } },
    };
    spec.paths[`/${plural}/{id}`] = {
      get: { summary: `Get ${lower}`, responses: { 200: { description: 'Success' } } },
      put: { summary: `Update ${lower}`, responses: { 200: { description: 'Updated' } } },
      delete: { summary: `Delete ${lower}`, responses: { 200: { description: 'Deleted' } } },
    };
  });

  return spec;
}

/**
 * Export as Postman Collection
 */
export function exportToPostman(api, baseUrl) {
  const schema = typeof api.schema_definition === 'string' 
    ? JSON.parse(api.schema_definition) : api.schema_definition;

  const collection = {
    info: {
      name: api.name,
      description: api.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'apiKey', value: 'YOUR_API_KEY' },
    ],
    item: [],
  };

  (schema.resources || []).forEach(resource => {
    const name = resource.name;
    const lower = name.toLowerCase();
    const plural = lower.endsWith('s') ? lower : `${lower}s`;

    const folder = {
      name,
      item: [
        {
          name: `List ${plural}`,
          request: {
            method: 'GET',
            url: `{{baseUrl}}/${plural}`,
            header: [{ key: 'X-API-Key', value: '{{apiKey}}' }],
          },
        },
        {
          name: `Create ${lower}`,
          request: {
            method: 'POST',
            url: `{{baseUrl}}/${plural}`,
            header: [
              { key: 'X-API-Key', value: '{{apiKey}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: { mode: 'raw', raw: JSON.stringify(buildExample(resource.fields), null, 2) },
          },
        },
        {
          name: `Get ${lower}`,
          request: { method: 'GET', url: `{{baseUrl}}/${plural}/{{id}}`, header: [{ key: 'X-API-Key', value: '{{apiKey}}' }] },
        },
        {
          name: `Update ${lower}`,
          request: { method: 'PUT', url: `{{baseUrl}}/${plural}/{{id}}`, header: [{ key: 'X-API-Key', value: '{{apiKey}}' }, { key: 'Content-Type', value: 'application/json' }] },
        },
        {
          name: `Delete ${lower}`,
          request: { method: 'DELETE', url: `{{baseUrl}}/${plural}/{{id}}`, header: [{ key: 'X-API-Key', value: '{{apiKey}}' }] },
        },
      ],
    };
    collection.item.push(folder);
  });

  return collection;
}

// Utility functions
function mapOpenApiType(schema) {
  if (!schema) return 'string';
  if (schema.format === 'email') return 'email';
  if (schema.format === 'uri') return 'url';
  if (schema.format === 'date' || schema.format === 'date-time') return 'date';
  if (schema.format === 'uuid') return 'uuid';
  return schema.type || 'string';
}

function mapToSpecType(type) {
  const map = { email: 'string', url: 'string', date: 'string', uuid: 'string' };
  return map[type] || type;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function singularize(w) {
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function buildExample(fields) {
  const obj = {};
  fields.forEach(f => {
    if (f.name === 'id') return;
    const examples = { string: 'example', number: 42, integer: 1, boolean: true, email: 'user@example.com', url: 'https://example.com', date: '2024-01-01', array: [], object: {} };
    obj[f.name] = f.example || examples[f.type] || 'value';
  });
  return obj;
}
