import { pickPermissionsRule } from "../../change";
import { SyncRequestContext } from "../../context";
import { applyPermissionNeededJoins } from "../join/permissions";
import { getEntitiesWithAccessBasedOn } from "./impact";
import { applyExactEntityWhere } from "./where";

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

  query = applyPermissionNeededJoins(
    query,
    impactedEntity,
    permissionRule,
    context.schema
  );

  const entityTypeColumn = context.db.raw("? as text", [impactedEntity]);

  query = applyExactEntityWhere(
    query,
    impactedEntity,
    changed.entity,
    changed.id,
    context
  );

  query = query.select([entityTypeColumn, `id`, "user_id"]);

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

  query = query.groupBy(["id", "user_id"]);

  return query;
}
