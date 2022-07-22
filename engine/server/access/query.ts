import { Knex } from "knex";
import { DbSchemaModel } from "../../schema/model";
import { WherePermission } from "../../schema/types";
import { resolveValuePointer } from "../../schema/utils";
import { pickPermissions } from "../change";
import { SyncRequestContext } from "../context";
import { createJoins, JoinInfo } from "./join";
import { createUserSelects } from "./userSelect";
import { createWhereConditions, WherePointer, WhereTree } from "./where";

type QueryBuilder = Knex.QueryBuilder;

function applyJoins(query: QueryBuilder, joins: JoinInfo[]) {
  for (const join of joins) {
    const { toColumn, fromColumn, alias, fromTable, toTable } = join;
    query = query.leftJoin(
      `${join.toTable} as ${alias}`,
      `${fromTable}.${fromColumn}`,
      "=",
      `${alias}.${toColumn}`
    );
  }

  return query;
}

function applySelects(query: QueryBuilder, selects: string[]) {
  for (const select of selects) {
    query = query.select(select);
  }

  return query;
}

function applyWherePointer(
  qb: QueryBuilder,
  where: WherePointer,
  context: SyncRequestContext
) {
  const { config, select } = where;
  const { $eq, $ne, $gt, $gte, $lt, $lte, $in, $notIn } = config;

  if ($eq !== undefined) {
    qb.where(select, "=", resolveValuePointer($eq, context));
  }

  if ($ne !== undefined) {
    qb.where(select, "!=", resolveValuePointer($ne, context));
  }

  if ($gt !== undefined) {
    qb.where(select, ">", resolveValuePointer($gt, context));
  }

  if ($gte !== undefined) {
    qb.where(select, ">=", resolveValuePointer($gte, context));
  }

  if ($lt !== undefined) {
    qb.where(select, "<", resolveValuePointer($lt, context));
  }

  if ($lte !== undefined) {
    qb.where(select, "<=", resolveValuePointer($lte, context));
  }

  if ($in !== undefined) {
    qb.whereIn(select, resolveValuePointer($in, context));
  }

  if ($notIn !== undefined) {
    qb.whereNotIn(select, resolveValuePointer($notIn, context));
  }

  return qb;
}

function applyWhere(
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
      applyWhere(qb, andCondition, context);
    });
  }

  for (const orCondition of or) {
    query = query.orWhere((qb) => {
      applyWhere(qb, orCondition, context);
    });
  }

  return query;
}

function createBasePermissionMapQuery<T>(
  entity: string,
  permission: WherePermission<T>,
  context: SyncRequestContext
) {
  const { db } = context;

  const joins = createJoins(entity, permission, context.schema);

  const [constantWhere] = createWhereConditions(
    entity,
    permission,
    context.schema
  );

  let rootQuery = db.from(`${entity}`);

  rootQuery = applyJoins(rootQuery, joins);
  rootQuery = applyWhere(rootQuery, constantWhere, context);

  return rootQuery;
}

function applyEntityIdSelect(query: QueryBuilder, entity: string) {
  return query.select(`${entity}.id`);
}

function applyEntityDataSelect(query: QueryBuilder, entity: string) {
  return query.select(`${entity}.*`);
}

function applyAllowedUsersSelect(
  query: QueryBuilder,
  entity: string,
  permission: WherePermission<any>,
  context: SyncRequestContext
) {
  const userSelects = createUserSelects(
    entity,
    permission,
    context.schema,
    "user"
  );

  query = applySelects(query, userSelects);

  return query;
}

function applyContextWhere(
  query: QueryBuilder,
  entity: string,
  permission: WherePermission<any>,
  context: SyncRequestContext
) {
  const [, contextualWhere] = createWhereConditions(
    entity,
    permission,
    context.schema
  );

  query = applyWhere(query, contextualWhere, context);

  return query;
}

export function createAccessQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermissions(context, entity, "read");

  if (!permission) return null;

  let query = createBasePermissionMapQuery(entity, permission, context);

  query = applyEntityIdSelect(query, entity);
  query = applyAllowedUsersSelect(query, entity, permission, context);

  return query;
}

export function createUserAccessQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermissions(context, entity, "read");

  if (!permission) return null;

  let query = createBasePermissionMapQuery(entity, permission, context);

  query = applyEntityIdSelect(query, entity);
  query = applyContextWhere(query, entity, permission, context);

  return query;
}

export function createInitialLoadQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermissions(context, entity, "read");

  if (!permission) return null;

  let query = createBasePermissionMapQuery(entity, permission, context);

  query = applyEntityDataSelect(query, entity);
  query = applyContextWhere(query, entity, permission, context);

  return query;
}
