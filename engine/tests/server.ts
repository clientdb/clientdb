import { DbSchema } from "../schema/schema";
import knex from "knex";
import { createSyncServer } from "../server";
import { permissions, schema, TestSchema } from "./schema";

export async function createTestServer() {
  const db = knex({
    client: "sqlite3",
    connection: {
      filename: ":memory:",
    },
    useNullAsDefault: true,
  });

  const server = createSyncServer<TestSchema>({
    db,
    schema: schema,
    requestHandlers: {
      getLastSyncId: async () => 2,
      getUserId: async () => "123",
    },
    permissions: permissions,
  });

  await server.initialize();

  return server;
}
