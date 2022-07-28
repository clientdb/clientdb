import { Knex } from "knex";
import { resolveValuePointer } from "../../schema/utils";
import { SyncRequestContext } from "../../server/context";
import { WherePointer, WhereTree } from "./conditions";

type QueryBuilder = Knex.QueryBuilder;

function applyWherePointer(
  qb: QueryBuilder,
  where: WherePointer,
  context: SyncRequestContext
) {
  const { condition, select } = where;

  if (typeof condition === "string") {
    qb.andWhere(select, "=", context.db.raw(`${condition}`));
    return qb;
  }
  const { $eq, $ne, $gt, $gte, $lt, $lte, $in, $notIn, $isNull } = condition;

  if ($eq !== undefined) {
    qb.andWhere(select, "=", resolveValuePointer($eq, context));
  }

  if ($ne !== undefined) {
    qb.andWhere(select, "!=", resolveValuePointer($ne, context));
  }

  if ($gt !== undefined) {
    qb.andWhere(select, ">", resolveValuePointer($gt, context));
  }

  if ($gte !== undefined) {
    qb.andWhere(select, ">=", resolveValuePointer($gte, context));
  }

  if ($lt !== undefined) {
    qb.andWhere(select, "<", resolveValuePointer($lt, context));
  }

  if ($lte !== undefined) {
    qb.andWhere(select, "<=", resolveValuePointer($lte, context));
  }

  if ($in !== undefined) {
    qb.andWhere(select, "in", resolveValuePointer($in, context));
  }

  if ($notIn !== undefined) {
    qb.andWhere(select, "not in", resolveValuePointer($notIn, context));
  }

  if ($isNull !== undefined) {
    const nullValue = resolveValuePointer($isNull, context);

    if (nullValue) {
      qb.andWhere(select, "is", null);
    } else {
      qb.andWhere(select, "is not", null);
    }
  }

  return qb;
}

export function applyQueryWhere(
  query: QueryBuilder,
  where: WhereTree,
  context: SyncRequestContext
) {
  const { conditions = [], and = [], or = [] } = where;

  for (const condition of conditions) {
    query = applyWherePointer(query, condition, context);
  }

  for (const andCondition of and) {
    query = query.andWhere((qb) => {
      applyQueryWhere(qb, andCondition, context);
    });
  }

  query = query.andWhere((qb) => {
    for (const orCondition of or) {
      qb.orWhere((qb) => {
        applyQueryWhere(qb, orCondition, context);
      });
    }
  });

  return query;
}
