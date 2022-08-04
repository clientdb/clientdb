import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { Transaction } from "@clientdb/server/query/types";
import { UnauthorizedError } from "../error";
import { PermissionOperationType } from "../permissions/input";

export async function getEntityIfAccessable<T>(
  tr: Transaction,
  entityInfo: EntityPointer,
  context: SyncRequestContext,
  inOperation: PermissionOperationType,
  includeData = false
) {
  const rule = context.permissions.getPermissionRule(
    entityInfo.entity,
    inOperation
  );

  if (!rule) {
    throw new UnauthorizedError(
      `Not allowed to ${inOperation} ${entityInfo.entity}`
    );
  }

  let accessedQuery = rule
    .accessQuery()
    .transacting(tr)
    .applyRules(context)
    .byId(entityInfo.id);
  let existingQuery = rule.accessQuery().transacting(tr).byId(entityInfo.id);

  if (includeData) {
    accessedQuery = accessedQuery.selectAllData();
    existingQuery = existingQuery.selectAllData();
  } else {
    accessedQuery = accessedQuery.selectId();
    existingQuery = existingQuery.selectId();
  }

  const existingAndAllowedItemQuery = tr
    .queryBuilder()
    .unionAll(accessedQuery.build(), true)
    .unionAll(existingQuery.build(), true);

  const result = await existingAndAllowedItemQuery;

  if (result.length === 0) {
    return null;
  }

  if (result.length === 1) {
    throw new UnauthorizedError(`Not allowed to access ${entityInfo.entity}`);
  }

  return result[0] as T;
}

export async function getHasUserAccessTo(
  tr: Transaction,
  entityInfo: EntityPointer,
  context: SyncRequestContext,
  type: PermissionOperationType
) {
  try {
    const item = await getEntityIfAccessable(tr, entityInfo, context, type);

    if (!item) {
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return false;
    } else {
      throw error;
    }
  }
}
