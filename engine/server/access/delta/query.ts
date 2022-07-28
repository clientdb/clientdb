import { pickPermissionsRule } from "../../change";
import { SyncRequestContext } from "../../context";
import { applyPermissionNeededJoins } from "../join/permissions";
import { getEntitiesWithAccessBasedOn } from "./impact";
import { createUserIdCoalease } from "./users";
import { applyAccessGainedWhere } from "./where";

interface AddedOrRemovedEntityInfo {
  // Entity that is either just created or about to be removed
  entity: string;
  id: string;
}

function createQueryOfEntitiesAccessedOnlyThanksTo(
  impactedEntity: string,
  changed: AddedOrRemovedEntityInfo,
  context: SyncRequestContext
) {
  let query = context.db.from(impactedEntity);

  const permissionRule = pickPermissionsRule(context, impactedEntity, "read");

  if (!permissionRule) {
    throw new Error(`No permission rule found for ${impactedEntity}`);
  }

  const idField = context.schema.getIdField(impactedEntity);

  if (!idField) {
    throw new Error(`No id field found for ${impactedEntity}`);
  }

  query = applyPermissionNeededJoins(
    query,
    impactedEntity,
    permissionRule,
    context.schema
  );

  const entityTypeColumn = context.db.raw("? as entity", [impactedEntity]);

  query = applyAccessGainedWhere(
    query,
    impactedEntity,
    changed.entity,
    changed.id,
    context
  );

  const userIdSelect = createUserIdCoalease(
    impactedEntity,
    permissionRule,
    context
  );

  query = query.select([
    entityTypeColumn,
    `${impactedEntity}.${idField} as id`,
    userIdSelect,
  ]);

  // query = query.groupBy([`${impactedEntity}.${idField}`, "user_id"]);

  return query;
}

export function createEntitiesAccessedThanksTo(
  changed: AddedOrRemovedEntityInfo,
  context: SyncRequestContext
) {
  const impactedEntities = getEntitiesWithAccessBasedOn(
    changed.entity,
    context
  );

  const impactInEntityQueries = impactedEntities.map((impactedEntity) => {
    return createQueryOfEntitiesAccessedOnlyThanksTo(
      impactedEntity,
      changed,
      context
    );
  });

  let query = context.db.queryBuilder();

  query = impactInEntityQueries.reduce((query, nextImpactedQuery) => {
    return query.unionAll(nextImpactedQuery);
  }, query);

  return query;
}
