import { Knex } from "knex";
import { DbSchemaModel } from "../../schema/model";
import { DbSchema } from "../../schema/schema";

export async function initializeSystemTables(db: Knex) {
  await db.transaction(async (tr) => {
    await tr.schema.createTable("sync", (table) => {
      table.increments("id").primary();
      table.string("entity").notNullable();
      table.enum("action", ["put", "delete"]).notNullable();
      table.uuid("entity_id").notNullable();
      table.uuid("user_id").notNullable();
      table.json("data").nullable();
    });

    await tr.schema.createTable("_clientdb", (table) => {
      table.uuid("id").primary();
      table.string("key");
      table.string("value");
    });
  });
}
