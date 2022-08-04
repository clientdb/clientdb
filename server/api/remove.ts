import { EntityRemoveChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { createLogger, logAll } from "@clientdb/server/utils/logger";
import { UnauthorizedError } from "../error";
import { EntityAddedOrRemovedDeltaBuilder } from "../permissions/EntityAddedOrRemovedDeltaBuilder";
import { getHasUserAccessTo } from "./entity";

const log = createLogger("Mutation");

export async function performRemove<T>(
  context: SyncRequestContext,
  input: EntityRemoveChange<T>
) {
  const { schema, db } = context;

  const entity = input.entity as any as string;
  const idField = schema.assertEntity(entity).idField;

  const entityPointer: EntityPointer = { entity, id: input.id };

  await db.transaction(async (tr) => {
    if (!(await getHasUserAccessTo(tr, entityPointer, context, "remove"))) {
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
