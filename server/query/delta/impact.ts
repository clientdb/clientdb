import { SyncRequestContext } from "@clientdb/server/context";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import { getRuleHas } from "@clientdb/server/permissions/traverse";
import { getIsRelationImpactedBy } from "./relation";

function getIsEntityAccessBasedOn(
  entity: string,
  changedEntity: string,
  context: SyncRequestContext
): boolean {
  const accessRules = pickPermissionsRule(context.permissions, entity, "read");

  if (!accessRules) return false;

  return getRuleHas(accessRules, {
    onRelation({ entity }) {
      return entity === changedEntity;
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
