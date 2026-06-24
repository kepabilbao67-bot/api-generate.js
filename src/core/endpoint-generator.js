/**
 * Endpoint Generator
 * Generates REST endpoints from resource definitions
 */

export function generateEndpoints(schema) {
  const endpoints = [];

  schema.resources.forEach(resource => {
    const name = resource.name.toLowerCase();
    const plural = name.endsWith('s') ? name : `${name}s`;
    const methods = resource.methods || ['GET', 'POST', 'PUT', 'DELETE'];

    if (methods.includes('GET')) {
      endpoints.push({
        method: 'GET',
        path: `/${plural}`,
        description: `List all ${plural}`,
        parameters: [
          { name: 'page', in: 'query', type: 'integer', description: 'Page number' },
          { name: 'limit', in: 'query', type: 'integer', description: 'Items per page' },
          { name: 'sort', in: 'query', type: 'string', description: 'Sort field:order (e.g. name:asc)' },
          { name: 'filter', in: 'query', type: 'string', description: 'JSON filter object' },
        ],
        response: { type: 'array', items: resource.fields },
      });

      endpoints.push({
        method: 'GET',
        path: `/${plural}/:id`,
        description: `Get a single ${name} by ID`,
        parameters: [{ name: 'id', in: 'path', type: 'string', required: true }],
        response: { type: 'object', properties: resource.fields },
      });
    }

    if (methods.includes('POST')) {
      endpoints.push({
        method: 'POST',
        path: `/${plural}`,
        description: `Create a new ${name}`,
        body: resource.fields.filter(f => f.name !== 'id'),
        response: { type: 'object', properties: resource.fields },
      });
    }

    if (methods.includes('PUT')) {
      endpoints.push({
        method: 'PUT',
        path: `/${plural}/:id`,
        description: `Update an existing ${name}`,
        parameters: [{ name: 'id', in: 'path', type: 'string', required: true }],
        body: resource.fields.filter(f => f.name !== 'id'),
        response: { type: 'object', properties: resource.fields },
      });
    }

    if (methods.includes('DELETE')) {
      endpoints.push({
        method: 'DELETE',
        path: `/${plural}/:id`,
        description: `Delete a ${name}`,
        parameters: [{ name: 'id', in: 'path', type: 'string', required: true }],
        response: { type: 'object', properties: { message: 'string' } },
      });
    }

    // Custom endpoints from schema
    if (resource.customEndpoints) {
      resource.customEndpoints.forEach(custom => {
        endpoints.push({
          method: custom.method || 'GET',
          path: `/${plural}${custom.path}`,
          description: custom.description || `Custom endpoint for ${name}`,
          parameters: custom.parameters || [],
          body: custom.body || null,
          response: custom.response || { type: 'object' },
        });
      });
    }
  });

  return endpoints;
}
