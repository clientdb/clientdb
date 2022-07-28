import { Knex } from "knex";
import { DbSchema } from "../schema/schema";
import { createLogger } from "../utils/logger";
import { createEntitiesAccessedThanksTo } from "./access/delta/query";
import { createAccessQuery } from "./access/query";
import { EntityChange } from "./change";
import { getIsChangeAllowed } from "./changePermission";
import { getIsChangeDataValid } from "./changeValidation";
import { SyncRequestContext } from "./context";

const log = createLogger("Mutation");

async function explainQuery(db: Knex, query: Knex.QueryBuilder) {
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

export async function performMutation<T, D>(
  context: SyncRequestContext,
  input: EntityChange<T, D>
): Promise<void> {
  const { schema, db } = context;

  const entityName = input.entity as any as string;

  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  const idField = schema.getIdField(entityName)!;

  switch (input.type) {
    case "remove": {
      const accessQuery = createAccessQuery(context, entityName, "remove")!;

      if (!accessQuery) {
        throw new Error("No access query found");
      }

      const updateQuery = db
        .table(entityName)
        .delete()
        .andWhere(`${entityName}.${idField}`, "=", input.id)
        .andWhere(`${entityName}.${idField}`, "in", accessQuery);

      log(updateQuery.toString());
      const results = await updateQuery;

      if (results === 0) {
        throw new Error("Not allowed to delete");
      }
      return;
    }
    case "update": {
      const accessQuery = createAccessQuery(context, entityName, "update")!;
      const updateQuery = db
        .table(entityName)
        .update(input.data)
        .andWhere(`${entityName}.${idField}`, "=", input.id)
        .andWhere(`${entityName}.${idField}`, "in", accessQuery);

      log(updateQuery.toString());

      const results = await updateQuery;

      if (results === 0) {
        throw new Error("Not allowed to update");
      }
      return;
    }
    case "create": {
      console.log("creating", input);
      try {
        await db.table(entityName).insert(input.data).returning(idField);
        console.log("did create", input);
      } catch (error) {
        console.log("create error", input, error);
        throw error;
      }

      if (input.data.id) {
        const deltaQuery = createEntitiesAccessedThanksTo(
          { entity: entityName, id: input.data.id },
          context
        );

        // const explainQuery = db.raw(`explain ?`, [deltaQuery]);

        const res = await deltaQuery;

        const full = await db.table(entityName).select("*");

        log(`create delta of ${entityName}`, entityName, input.data.id);
        log(deltaQuery.toString());
        console.log("res of " + entityName, res);
        console.log("all", full.length);
        await explainQuery(db, deltaQuery);
      }
      return;
    }
  }
}
