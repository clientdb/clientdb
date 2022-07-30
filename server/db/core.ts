import { DbSchemaModel } from "@clientdb/schema";
import { Knex } from "knex";

export async function initializeSystemTables(
  db: Knex,
  schema: DbSchemaModel,
  userTable: string
) {
  const userIdField = schema.getIdField(userTable);

  if (!userIdField) {
    throw new Error(`No id field found for ${userTable}`);
  }

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
        .references(`${userTable}.${userIdField}`)
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
