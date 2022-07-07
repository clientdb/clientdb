import connect, { sql } from "@databases/pg";

import introspectDb, {
  ArrayType,
  Schema,
} from "@databases/pg-schema-introspect";

export function createClientFromSchema(schema: Schema) {
  schema.classes;
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

  const schema = await introspectDb(db);

  console.log(JSON.stringify(schema, undefined, 2));

  createClientFromSchema(schema);
}

generate();
