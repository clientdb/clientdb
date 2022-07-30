import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import { SchemaPermissions } from "@clientdb/server/permissions/types";
import { Knex } from "knex";
import { DbSchemaModel } from "../../schema/model";
import { traversePermissions } from "../permissions/traverse";

function collectPermissionNeededIndices(
  schema: DbSchemaModel,
  permissions: SchemaPermissions
) {
  const indices: Record<string, Set<string>> = {};

  function addIndex(entity: string, field: string) {
    let entityIndices = indices[entity];

    if (!entityIndices) {
      entityIndices = new Set();
      indices[entity] = entityIndices;
    }

    entityIndices.add(field);
  }

  for (const permissionEntity in permissions) {
    const readPermissions = pickPermissionsRule(
      permissions,
      permissionEntity,
      "read"
    );

    const idField = schema.getIdField(permissionEntity)!;

    if (!readPermissions) continue;

    traversePermissions(permissionEntity, readPermissions, schema, {
      onValue(info) {
        const referencedEntity = schema.getEntityReferencedBy(
          info.table,
          info.field
        );

        if (referencedEntity) return;

        const attribute = schema.getAttribute(info.table, info.field);

        if (!attribute) return;

        if (info.field === idField) return;

        addIndex(info.table, info.field);
      },
    });
  }

  return indices;
}

export async function initializeTablesFromSchema(
  db: Knex,
  schemaModel: DbSchemaModel,
  permissions: SchemaPermissions<any>
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
            const referencedTableIdField = schemaModel.getIdField(
              relation.target
            );

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
