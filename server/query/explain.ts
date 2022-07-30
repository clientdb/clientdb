import { Knex } from "knex";
import { log } from "@clientdb/server/utils/logger";

async function explainQuery(query: Knex.QueryBuilder) {
  const db = query.client;
  const explainQuery = db.raw("explain ANALYZE ?", [db.raw(query.toString())]);

  const explainResult = await explainQuery;

  const explainOutput = explainResult.rows
    .map((row: any) => {
      return row["QUERY PLAN"];
    })
    .join("\n");

  log("Explaining", query.toString());
  log(explainOutput);
}
