/**
 * Validation Generator
 * Creates Joi validation schemas from resource field definitions
 */

import Joi from 'joi';

const typeMap = {
  string: () => Joi.string(),
  number: () => Joi.number(),
  integer: () => Joi.number().integer(),
  boolean: () => Joi.boolean(),
  array: () => Joi.array(),
  object: () => Joi.object(),
  date: () => Joi.date().iso(),
  email: () => Joi.string().email(),
  url: () => Joi.string().uri(),
  uuid: () => Joi.string().uuid(),
};

export function generateValidation(schema) {
  const validations = {};

  schema.resources.forEach(resource => {
    const name = resource.name.toLowerCase();
    validations[name] = {
      create: buildCreateSchema(resource.fields),
      update: buildUpdateSchema(resource.fields),
    };
  });

  return validations;
}

function buildCreateSchema(fields) {
  const schemaObj = {};

  fields.forEach(field => {
    if (field.name === 'id') return; // Auto-generated

    let validator = typeMap[field.type] ? typeMap[field.type]() : Joi.any();

    if (field.required) validator = validator.required();
    if (field.min !== undefined) validator = validator.min(field.min);
    if (field.max !== undefined) validator = validator.max(field.max);
    if (field.default !== undefined) validator = validator.default(field.default);
    if (field.enum) validator = validator.valid(...field.enum);
    if (field.pattern) validator = validator.pattern(new RegExp(field.pattern));

    schemaObj[field.name] = validator;
  });

  return Joi.object(schemaObj);
}

function buildUpdateSchema(fields) {
  const schemaObj = {};

  fields.forEach(field => {
    if (field.name === 'id') return;

    let validator = typeMap[field.type] ? typeMap[field.type]() : Joi.any();

    // All fields optional on update
    if (field.min !== undefined) validator = validator.min(field.min);
    if (field.max !== undefined) validator = validator.max(field.max);
    if (field.enum) validator = validator.valid(...field.enum);

    schemaObj[field.name] = validator;
  });

  return Joi.object(schemaObj).min(1); // At least one field required
}

/**
 * Validate request body against generated schema
 */
export function validateBody(validationSchema, body) {
  const { error, value } = validationSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    };
  }

  return { valid: true, data: value };
}
