import knex, { Knex } from "knex";
import { createSyncServer } from "@clientdb/server/server";
import { permissions, schema, TestSchema } from "./schema";

import { restartDb } from "./db";

export const testDb = knex({
  client: "pg",
  connection: `postgres://postgres:postgrespassword@localhost:5438/test`,
  useNullAsDefault: true,
});

afterAll(() => {
  testDb.destroy();
});

export async function createTestServer() {
  await restartDb(testDb);

  const server = createSyncServer<TestSchema>({
    db: testDb,
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
