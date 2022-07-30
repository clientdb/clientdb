import knex from "knex";
import { createSyncServer } from "@clientdb/server/server";
import { permissions, schema, TestSchema } from "./schema";

import { restartDb } from "./db";

export async function createTestServer() {
  // const postgres = await new PostgreSqlContainer()
  //   .withExposedPorts(5432)
  //   .start();

  const db = knex({
    client: "pg",
    connection: `postgres://postgres:postgrespassword@localhost:5438/test`,
    useNullAsDefault: true,
  });

  await restartDb(db);

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
