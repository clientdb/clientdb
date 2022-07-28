import { Knex } from "knex";
import { DbSchemaModel } from "../../schema/model";
import { DbSchema } from "../../schema/schema";

export async function initializeTablesFromSchema(
  db: Knex,
  schemaModel: DbSchemaModel
) {
  const schemaUpdate = db.transaction(async (tr) => {
    for (const entity of schemaModel.entities) {
      await tr.schema.transacting(tr).createTable(entity.name, (table) => {
        for (const attribute of entity.attributes) {
          table.specificType(attribute.name, attribute.type);
        }

        if (entity.idField) {
          table.primary([entity.idField]);
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

  const sql = schemaUpdate.toString();

  await schemaUpdate;
}
