import connect, { Queryable, sql } from "@databases/pg";

import introspectDb from "@databases/pg-schema-introspect";
import { generateClient } from "../generate/generateClient";
import { parseDatabaseSchema } from "../introspection/pg";

async function getDbTypes(db: Queryable) {
  const rows = await db.query(sql`SELECT * FROM pg_type`);

  const lookup = new Map<number, string>();

  for (const row of rows) {
    if (lookup.has(row.oid)) continue;

    lookup.set(row.oid, row.typname);
  }

  return lookup;
}

async function generate() {
  const db = connect({
    bigIntMode: "number",
    port: 8001,
    user: "postgres",
    password: "postgres",
    database: "cdb",
    host: "localhost",
  });

  const pgSchema = await introspectDb(db, { schemaName: "public" });

  const parsedSchema = parseDatabaseSchema({
    typesLookup: await getDbTypes(db),
    schema: pgSchema,
    classEntityLookup: new Map(),
  });

  generateClient(parsedSchema);

  return parsedSchema;
}

generate();

// Keep ts-node-dev alive
setInterval(() => {
  2 + 2;
}, 1000);
