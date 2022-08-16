import { EntitiesSchema } from "@clientdb/schema";
import { Knex } from "knex";
import { PermissionsRoot } from "../permissions/PermissionsRoot";

function collectPermissionNeededIndices<Schema>(
  schema: EntitiesSchema,
  permissions: PermissionsRoot<Schema>
) {
  const indices: Record<string, Set<string>> = {};

  for (const entity of schema.entities) {
    for (const relation of entity.relations) {
      if (relation.type === "reference") {
        addIndex(entity.name, relation.field);
      }
    }
  }

  function addIndex(entity: string, field: string) {
    let entityIndices = indices[entity];

    if (!entityIndices) {
      entityIndices = new Set();
      indices[entity] = entityIndices;
    }

    entityIndices.add(field);
  }

  return indices;
}

export async function initializeTablesFromSchema(
  db: Knex,
  schemaModel: EntitiesSchema,
  permissions: PermissionsRoot<any>
) {
  const permissionIndices = collectPermissionNeededIndices(
    schemaModel,
    permissions
  );

  const schemaUpdate = db.transaction(async (tr) => {
    for (const entity of schemaModel.entities) {
      await tr.schema.transacting(tr).createTable(entity.name, (table) => {
        for (const attribute of entity.attributes) {
          table.specificType(attribute.name, attribute.type);
        }

        if (entity.idField) {
          table.primary([entity.idField]);
        }

        const indexesToAdd = permissionIndices[entity.name];

        if (indexesToAdd) {
          for (const index of indexesToAdd) {
            table.index(index);
          }
        }
      });
    }

    for (const entity of schemaModel.entities) {
      await tr.schema.transacting(tr).alterTable(entity.name, (table) => {
        for (const relation of entity.relations) {
          if (relation.type === "reference") {
            const referencedTableIdField = schemaModel.assertEntity(
              relation.target
            ).idField;

            table
              .foreign(relation.field)
              .references(`${relation.target}.${referencedTableIdField}`)
              .onUpdate("cascade")
              .onDelete("cascade");

            // table.index(relation.referenceField, undefined, "btree");
          }
        }
      });
    }
  });

  await schemaUpdate;
}
