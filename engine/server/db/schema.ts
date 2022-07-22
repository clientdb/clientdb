import { Knex } from "knex";
import { DbSchemaModel } from "../../schema/model";
import { DbSchema } from "../../schema/schema";

export async function initializeTablesFromSchema(
  db: Knex,
  schemaModel: DbSchemaModel
) {
  await db.transaction(async (tr) => {
    for (const entity of schemaModel.entities) {
      await tr.schema.createTable(entity.name, (table) => {
        for (const attribute of entity.attributes) {
          table.specificType(attribute.name, attribute.type);
        }

        if (entity.idField) {
          table.primary([entity.idField]);
        }

        for (const relation of entity.relations) {
          if (relation.type === "reference") {
            const referencedTableIdField = schemaModel.getIdField(
              relation.referencedEntity
            );

            table
              .foreign(relation.referenceField)
              .references(
                `${relation.referencedEntity}.${referencedTableIdField}`
              )
              .onUpdate("cascade")
              .onDelete("cascade");
          }
        }
      });
    }
  });
}
