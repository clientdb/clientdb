import { DbSchema } from "../schema/schema";
import knex from "knex";
import { createSyncServer } from "../server";
import { permissions, schema, TestSchema } from "./schema";

import { PostgreSqlContainer } from "testcontainers";

export async function createTestServer() {
  const postgres = await new PostgreSqlContainer()
    .withExposedPorts(5432)
    .start();

  const db = knex({
    client: "pg",
    connection: {
      host: postgres.getHost(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
      user: postgres.getUsername(),
      port: postgres.getPort(),
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
