import connect from "@databases/pg";

import { generateClient } from "./generate/all";
import { introspectPGSchema } from "./introspection/pg";

async function generate() {
  const db = connect({
    bigIntMode: "number",
    port: 8001,
    user: "postgres",
    password: "postgres",
    database: "cdb",
    host: "localhost",
  });

  const schema = await introspectPGSchema(db);

  generateClient(schema);
}

generate();
