import { EntityRemoveChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { createLogger } from "@clientdb/server/utils/logger";
import { UnauthorizedError } from "../error";
import { AccessQueryBuilder } from "../permissions/AccessQueryBuilder";
import { EntityAddedOrRemovedDeltaBuilder } from "../permissions/EntityAddedOrRemovedDeltaBuilder";

const log = createLogger("Mutation");

export async function performRemove<T>(
  context: SyncRequestContext,
  input: EntityRemoveChange<T>
) {
  const { schema, db, permissions } = context;

  const entity = input.entity as any as string;
  const idField = schema.assertEntity(entity).idField;

  const rule = permissions.assertPermissionRule(entity, "remove");

  const accessQuery = new AccessQueryBuilder(rule, context);

  await db.transaction(async (tr) => {
    if (!accessQuery.canUserAccess(tr, input.id)) {
      throw new UnauthorizedError(`Not allowed to remove ${entity}`);
    }

    const deltaQuery = new EntityAddedOrRemovedDeltaBuilder(
      { id: input.id, entity },
      context
    );

    log(
      "remove delta",
      { entity, id: input.id },
      deltaQuery.buildForType("delete", context).toString()
    );

    await deltaQuery.insert(tr, "delete", context);

    const removeQuery = tr
      .table(entity)
      .delete()
      .andWhere(`${entity}.${idField}`, "=", input.id);

    log.debug("remove query", removeQuery.toString());
    const results = await removeQuery;

    if (results === 0) {
      throw new Error(`Not allowed to remove ${entity}`);
    }
  });
}
