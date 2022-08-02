import { DbSchemaModel } from "@clientdb/schema";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import { traverseRule } from "@clientdb/server/permissions/traverse";
import { Knex } from "knex";
import { SchemaPermissionsModel } from "../permissions/model";

function collectPermissionNeededIndices(
  schema: DbSchemaModel,
  permissions: SchemaPermissionsModel
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

    traverseRule(readPermissions, {
      onValue(info) {
        const referencedEntity = schema.getEntityReferencedBy(
          info.entity,
          info.field
        );

        if (referencedEntity) return;

        const attribute = schema.getAttribute(info.entity, info.field);

        if (!attribute) return;

        if (info.field === idField) return;

        addIndex(info.entity, info.field);
      },
    });
  }

  return indices;
}

export async function initializeTablesFromSchema(
  db: Knex,
  schemaModel: DbSchemaModel,
  permissions: SchemaPermissionsModel<any>
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
