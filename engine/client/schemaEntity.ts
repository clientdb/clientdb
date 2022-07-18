import { defineEntity, EntityDefinition } from "@clientdb/core";
import { DbSchema } from "../schema/schema";

export function createEntityFromSchema<D, V>(
  schema: DbSchema,
  entityName: string
): EntityDefinition<D, V> {
  const entitySchema = schema.entities.find((e) => e.name === entityName);

  if (!entitySchema) {
    throw new Error(`Entity ${entityName} not found in schema`);
  }

  return defineEntity({
    idField: entitySchema.idField,
    name: entitySchema.name,
    fields: entitySchema.attributes.map((attr) => attr.name),
  }) as any;
}
