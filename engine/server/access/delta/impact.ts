import { pickPermissionsRule } from "../../change";
import { SyncRequestContext } from "../../context";
import { getHasPermission } from "../../permissions/traverse";
import { getIsRelationImpactedBy } from "./relation";

function getIsEntityAccessBasedOn(
  maybeBasedEntity: string,
  changedEntity: string,
  context: SyncRequestContext
): boolean {
  const accessRules = pickPermissionsRule(
    context.permissions,
    maybeBasedEntity,
    "read"
  );

  if (!accessRules) return false;

  return getHasPermission(maybeBasedEntity, accessRules, context.schema, {
    onRelation({ relation }) {
      return getIsRelationImpactedBy(relation, changedEntity);
    },
  });
}

export function getEntitiesWithAccessBasedOn(
  changedEntity: string,
  context: SyncRequestContext
): string[] {
  const { permissions } = context;

  const entitiesMaybeImpacted = Object.keys(permissions).filter(
    (otherEntity) => {
      if (otherEntity === changedEntity) return true;

      return getIsEntityAccessBasedOn(otherEntity, changedEntity, context);
    }
  );

  return entitiesMaybeImpacted;
}
