import { Knex } from "knex";
import { DbSchemaModel } from "../../schema/model";
import { EntityReadPermissionConfig, PermissionRule } from "../../schema/types";
import { resolveValuePointer } from "../../schema/utils";
import { createLogger } from "../../utils/logger";
import { pickPermission, pickPermissionsRules } from "../change";
import { SyncRequestContext } from "../context";
import { createJoins, JoinInfo } from "./join";
import { createUserSelects } from "./userSelect";
import { createWhereConditions, WherePointer, WhereTree } from "./where";

type QueryBuilder = Knex.QueryBuilder;

const log = createLogger("Permission query", false);

function applyJoins(query: QueryBuilder, joins: JoinInfo[]) {
  for (const join of joins) {
    const { toColumn, fromColumn, alias, from, table } = join;
    query = query.leftJoin(
      `${join.table} as ${alias}`,
      `${from}.${fromColumn}`,
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

  query = query.andWhere((qb) => {
    for (const orCondition of or) {
      qb.orWhere((qb) => {
        applyWhere(qb, orCondition, context);
      });
    }
  });

  return query;
}

function createBasePermissionMapQuery<T>(
  entity: string,
  rule: PermissionRule<T>,
  context: SyncRequestContext
) {
  const { db } = context;

  const joins = createJoins(entity, rule, context.schema);

  let rootQuery = db.from(`${entity}`);

  rootQuery = applyJoins(rootQuery, joins);
  rootQuery = applyWhereCauses(rootQuery, entity, rule, context);

  return rootQuery;
}

function applyEntityIdSelect(query: QueryBuilder, entity: string) {
  return query.select(`${entity}.id`);
}

function applyEntityDataSelect(
  query: QueryBuilder,
  entity: string,
  permission: EntityReadPermissionConfig<any>
) {
  const { fields } = permission;

  if (!fields) {
    return query.select(`${entity}.*`);
  }

  const selectFields = fields.map((field) => {
    return `${entity}.${field}`;
  });

  return query.select(selectFields);
}

function applyAllowedUsersSelect(
  query: QueryBuilder,
  entity: string,
  permission: PermissionRule<any>,
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

function applyWhereCauses(
  query: QueryBuilder,
  entity: string,
  permission: PermissionRule<any>,
  context: SyncRequestContext
) {
  const conditions = createWhereConditions(entity, permission, context.schema);

  query = applyWhere(query, conditions, context);

  return query;
}

export function createAccessQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermissionsRules(context, entity, "read");

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
  const readRules = pickPermissionsRules(context, entity, "read");

  if (!readRules) return null;

  let query = createBasePermissionMapQuery(entity, readRules, context);

  query = applyEntityIdSelect(query, entity);

  return query;
}

export function createInitialLoadQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermission(context, entity, "read");

  if (!permission) return null;

  let query = createBasePermissionMapQuery(entity, permission.rule, context);

  query = applyEntityDataSelect(query, entity, permission);

  query = query.groupBy(`${entity}.${context.schema.getIdField(entity)}`);

  log("init", query.toString(), { permission });

  return query;
}
