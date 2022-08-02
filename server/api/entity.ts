import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { PermissionOperationType } from "@clientdb/server/permissions/types";
import {
  applySingleItemWhere,
  createAccessItemQuery,
} from "@clientdb/server/query/access";
import { Transaction } from "@clientdb/server/query/types";
import { UnauthorizedError } from "../error";
import { applyEntityIdSelect } from "../query/select/entity";

export async function getEntityIfAccessable<T>(
  tr: Transaction,
  entityInfo: EntityPointer,
  context: SyncRequestContext,
  inOperation: PermissionOperationType
) {
  const idField = context.schema.getIdField(entityInfo.entity);

  if (!idField) {
    throw new Error(`No id field for ${entityInfo.entity}`);
  }

  let existingItemQuery = tr.table(entityInfo.entity).transacting(tr).limit(1);

  existingItemQuery = applyEntityIdSelect(
    existingItemQuery,
    entityInfo.entity,
    context.schema
  );

  existingItemQuery = applySingleItemWhere(
    existingItemQuery,
    entityInfo,
    context
  );

  const allowedItemQuery = createAccessItemQuery(
    context,
    entityInfo,
    inOperation
  )?.transacting(tr);

  if (!allowedItemQuery) return null;

  const existingAndAllowedItemQuery = tr
    .queryBuilder()
    .unionAll(existingItemQuery, true)
    .unionAll(allowedItemQuery, true);

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
