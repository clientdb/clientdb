import { SchemaEntity } from "./schema";
import { validate } from "uuid";

function getIsDataTypeValid(input: unknown, type: string) {
  // TODO: all pg types
  switch (type) {
    case "string":
    case "text":
      return typeof input === "string";
    case "number":
      return typeof input === "number";
    case "bool":
    case "boolean":
      return typeof input === "boolean";
    case "uuid":
      return validate(input as string);
    case "date":
      return typeof input === "string" && !!input.match(/^\d{4}-\d{2}-\d{2}$/);
    case "datetime":
      return (
        typeof input === "string" &&
        !!input.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
      );
    case "object":
      return typeof input === "object";
    case "array":
      return Array.isArray(input);
    default:
      return false;
  }
}

export function validateEntityDataProp(
  prop: string,
  value: unknown,
  schema: SchemaEntity
) {
  const attribute = schema.attributes.find((a) => a.name === prop);
  if (!attribute) {
    throw new Error(`Attribute ${prop} not found in entity ${schema.name}`);
  }

  if (attribute.isNullable && (value === null || value === undefined)) {
    return;
  }

  if (!getIsDataTypeValid(value, attribute.type)) {
    if (value === null || value === undefined) {
      throw new Error(
        `Attribute '${prop}' of entity '${schema.name}' is required.`
      );
    }
    throw new Error(
      `Attribute '${prop}' of entity '${schema.name}' has invalid value for type '${attribute.type}' (${value})`
    );
  }
}

export function validateEntityData(
  data: Record<any, any>,
  schema: SchemaEntity
) {
  for (const attr of schema.attributes) {
    const value = data[attr.name];

    validateEntityDataProp(attr.name, value, schema);
  }
}

export function validateEntityUpdateData(
  data: Record<any, any>,
  schema: SchemaEntity
) {
  const keys = Object.keys(data);

  for (const key of keys) {
    const value = data[key];

    validateEntityDataProp(key, value, schema);
  }
}
