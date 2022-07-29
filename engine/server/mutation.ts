import { Knex } from "knex";
import { DbSchema } from "../schema/schema";
import { PermissionOperationType } from "../schema/types";
import { unsafeAssertType } from "../utils/assert";
import { createLogger } from "../utils/logger";
import { createDeltaQueriesForChange } from "./access/delta/query";
import { DeltaType } from "./access/delta/type";
import { createAccessQuery } from "./access/query";
import {
  EntityChange,
  EntityCreateChange,
  EntityRemoveChange,
  EntityUpdateChange,
} from "./change";
import { getIsChangeAllowed } from "./changePermission";
import { getIsChangeDataValid } from "./changeValidation";
import { SyncRequestContext } from "./context";

type Transaction = Knex.Transaction;

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

async function insertDeltaForChange(
  tr: Transaction,
  entity: string,
  id: string,
  context: SyncRequestContext,
  type: DeltaType
) {
  const deltaQuery = createDeltaQueriesForChange(
    { entity, id },
    context,
    type
  ).transacting(tr);

  const deltaResults = await deltaQuery;

  await tr.table("sync").insert(deltaResults);
}

async function getHasUserAccessTo(
  tr: Transaction,
  entity: string,
  id: string,
  context: SyncRequestContext,
  type: PermissionOperationType
) {
  const idField = context.schema.getIdField(entity);

  if (!idField) {
    throw new Error(`No id field for ${entity}`);
  }

  const query = createAccessQuery(context, entity, type)
    ?.andWhere(`${entity}.${idField}`, id)
    .transacting(tr);

  if (!query) return false;

  const result = await query;

  return result.length > 0;
}

async function performRemove<T>(
  context: SyncRequestContext,
  input: EntityRemoveChange<T>
) {
  const { schema, db } = context;

  const entityName = input.entity as any as string;
  const idField = schema.getIdField(entityName)!;

  await db.transaction(async (tr) => {
    if (
      !(await getHasUserAccessTo(tr, entityName, input.id, context, "remove"))
    ) {
      throw new Error(`Not allowed to remove ${entityName}`);
    }

    await insertDeltaForChange(tr, entityName, input.id, context, "delete");

    const removeQuery = tr
      .table(entityName)
      .delete()
      .andWhere(`${entityName}.${idField}`, "=", input.id);

    log("remove query", removeQuery.toString());
    const results = await removeQuery;

    if (results === 0) {
      throw new Error(`Not allowed to remove ${entityName}`);
    }
  });
}

async function performUpdate<T, D>(
  context: SyncRequestContext,
  input: EntityUpdateChange<T, D>
) {
  const { schema, db } = context;

  const entityName = input.entity as any as string;
  const idField = schema.getIdField(entityName)!;

  return await db.transaction(async (tr) => {
    unsafeAssertType<"update">(input.type);

    if (
      !(await getHasUserAccessTo(tr, entityName, input.id, context, "update"))
    ) {
      throw new Error(`Not allowed to update ${entityName}`);
    }

    const updateQuery = tr
      .table(entityName)
      .update(input.data)
      .where(`${entityName}.${idField}`, "=", input.id);

    log(updateQuery.toString());

    const results = await updateQuery;

    if (results === 0) {
      throw new Error(`Not allowed to update ${entityName}`);
    }
  });
}

async function performCreate<T, D>(
  context: SyncRequestContext,
  input: EntityCreateChange<T, D>
) {
  const { schema, db } = context;

  const entityName = input.entity as any as string;
  const idField = schema.getIdField(entityName)!;

  await db.transaction(async (tr) => {
    unsafeAssertType<"create">(input.type);

    const result = await tr
      .table(entityName)
      .insert(input.data)
      .returning(idField);

    if (result.length === 0) {
      throw new Error(`Not allowed to create ${entityName}`);
    }

    const id = result[0][idField]!;

    if (!(await getHasUserAccessTo(tr, entityName, id, context, "create"))) {
      throw new Error(`Not allowed to create ${entityName}`);
    }

    await insertDeltaForChange(tr, entityName, id, context, "put");

    log(`create delta of ${entityName}`, entityName, id);

    return;
  });
}

export async function performMutation<T, D>(
  context: SyncRequestContext,
  input: EntityChange<T, D>
): Promise<void> {
  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  log("Performing mutation", input);

  try {
    switch (input.type) {
      case "remove": {
        await performRemove(context, input);
        return;
      }
      case "update": {
        await performUpdate(context, input);
        return;
      }
      case "create": {
        await performCreate(context, input);
        return;
      }
    }
  } catch (error) {
    log("Failed to perform mutation", input, error);
    throw error;
  }
}
