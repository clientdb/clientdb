import { SyncRequestContext } from "../context";
import { EntityPointer } from "../entity/pointer";
import { PermissionOperationType } from "../permissions/types";
import { createAccessQuery } from "../query/access";
import { Transaction } from "../query/types";

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

  const query = createAccessQuery(context, entityInfo.entity, inOperation)
    ?.andWhere(`${entityInfo.entity}.${idField}`, entityInfo.id)
    .transacting(tr);

  if (!query) return null;

  const result = await query;

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

export async function getHasUserAccessTo(
  tr: Transaction,
  entityInfo: EntityPointer,
  context: SyncRequestContext,
  type: PermissionOperationType
) {
  const item = await getEntityIfAccessable(tr, entityInfo, context, type);

  if (!item) {
    return false;
  }

  return true;
}