import { SyncRequestContext } from "@clientdb/server/context";
import { DeltaType } from "@clientdb/server/db/delta";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { createBaseDeltaQuery } from "./baseQuery";
import { applyDeltaWhereOnCreatedOrRemoved } from "./createdOrRemovedWhere";
import { getEntitiesWithAccessBasedOn } from "./impact";

export function createDeltaQueryForCreatedOrRemoved(
  changed: EntityPointer,
  context: SyncRequestContext,
  type: DeltaType
) {
  const impactedEntities = getEntitiesWithAccessBasedOn(
    changed.entity,
    context
  );

  return createBaseDeltaQuery({
    changed,
    context,
    deltaType: type,
    impactedEntities,
    whereGetter: applyDeltaWhereOnCreatedOrRemoved,
  });
}
