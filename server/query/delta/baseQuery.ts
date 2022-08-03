import { SyncRequestContext } from "@clientdb/server/context";
import { DeltaType } from "@clientdb/server/db/delta";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { applyPermissionNeededJoins } from "@clientdb/server/permissions/joins";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import { createEntityDataSelect } from "@clientdb/server/query/select/entity";
import { QueryBuilder } from "../types";

interface DeltaWhereGetterInput {
  query: QueryBuilder;
  entity: string;
  change: EntityPointer;
  context: SyncRequestContext;
}

export type DeltaWhereGetter = (input: DeltaWhereGetterInput) => QueryBuilder;

interface DeltaQueryInput {
  changed: EntityPointer;
  context: SyncRequestContext;
  deltaType: DeltaType;
  whereGetter: DeltaWhereGetter;
  impactedEntities: string[];
}

function createBaseDeltaQueryForEntity(
  entity: string,
  { changed, context, deltaType, whereGetter }: DeltaQueryInput
) {
  const userTable = context.config.userTable;
  const userIdField = context.schema.getIdField(userTable)!;

  const permissionRule = pickPermissionsRule(
    context.permissions,
    entity,
    "read"
  );

  if (!permissionRule) {
    throw new Error(`No permission rule found for ${entity}`);
  }

  const idField = context.schema.getIdField(entity);

  if (!idField) {
    throw new Error(`No id field found for ${entity}`);
  }

  const db = context.db;

  let query = context.db
    .from(entity)
    .crossJoin(db.ref(`${userTable} as allowed_user`));

  query = applyPermissionNeededJoins(query, permissionRule);

  const entityTypeColumn = context.db.raw("? as entity", [entity]);
  const deltaTypeColumn = context.db.raw("? as type", [deltaType]);
  const nullDataColumn = context.db.raw("json_build_object() as data");

  // context.db.raw(`json_build_object(${jsonFieldsSpec}) as ${aliasRef}`)÷

  const filledDataColumn = createEntityDataSelect({
    entity,
    context,
    alias: "data",
  });

  query = whereGetter({ query, entity, change: changed, context });

  const entityIdSelectColumn = `${entity}.${idField}`;
  const allowedUserIdSelectColumn = `allowed_user.${userIdField}`;

  query = query.select([
    entityTypeColumn,
    deltaTypeColumn,
    db.ref(`${entityIdSelectColumn} as entity_id`),
    db.ref(`${allowedUserIdSelectColumn} as user_id`),
    deltaType === "put" ? filledDataColumn : nullDataColumn,
  ]);

  query = query.groupBy([entityIdSelectColumn, allowedUserIdSelectColumn]);

  return query;
}

export function createBaseDeltaQuery(input: DeltaQueryInput) {
  const { context, impactedEntities } = input;
  const deltaQueriesForEntities = impactedEntities.map((impactedEntity) => {
    return createBaseDeltaQueryForEntity(impactedEntity, input);
  });

  let query = context.db.queryBuilder();

  query = deltaQueriesForEntities.reduce((query, nextImpactedQuery) => {
    return query.unionAll(nextImpactedQuery);
  }, query);

  return query;
}
