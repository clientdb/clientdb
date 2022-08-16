import { EntitiesSchema } from "@clientdb/schema";
import { Knex } from "knex";

export async function initializeSystemTables(schema: EntitiesSchema) {
  const { userTableName, db } = schema;
  const userIdField = schema.assertEntity(userTableName).idField;

  await db.transaction(async (tr) => {
    await tr.schema.createTable("sync", (table) => {
      table.increments("id").primary();
      table.enum("type", ["put", "delete"]).notNullable();
      table.string("entity").notNullable();
      /**
       * We intentionally do not set FK connecting entity_id as we want sync event about given entity to persist, even if entity itself was removed
       * so user can sync this removal later
       */
      table.uuid("entity_id").notNullable();
      // TODO: Assumes user id is a uuid
      table.uuid("user_id").notNullable();
      table.json("data").nullable();

      table
        .foreign("user_id")
        .references(`${userTableName}.${userIdField}`)
        .onUpdate("cascade")
        .onDelete("cascade");
    });

    await tr.schema.createTable("_clientdb", (table) => {
      table.uuid("id").primary();
      table.string("key");
      table.string("value");
    });
  });
}
