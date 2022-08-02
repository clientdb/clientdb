import { SyncRequestContext } from "@clientdb/server/context";
import { resolveValuePointer } from "@clientdb/server/permissions/value";
import { Knex } from "knex";
import { WherePointer, WhereTree } from "./tree";

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

export function applyWhereTreeToQuery(
  query: QueryBuilder,
  where: WhereTree,
  context: SyncRequestContext
) {
  query = query.andWhere((qb) => {
    const { conditions = [], and = [], or = [] } = where;

    for (const condition of conditions) {
      qb = applyWherePointer(qb, condition, context);
    }

    for (const andCondition of and) {
      qb = qb.andWhere((qb) => {
        applyWhereTreeToQuery(qb, andCondition, context);
      });
    }

    qb = qb.andWhere((qb) => {
      for (const orCondition of or) {
        qb.orWhere((qb) => {
          applyWhereTreeToQuery(qb, orCondition, context);
        });
      }
    });

    return query;
  });

  return query;
}
