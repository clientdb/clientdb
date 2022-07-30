import { EntityUpdateChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { unsafeAssertType } from "@clientdb/server/utils/assert";
import { createLogger } from "@clientdb/server/utils/logger";
import { getHasUserAccessTo } from "./entity";

const log = createLogger("Mutation");

export async function performUpdate<T, D>(
  context: SyncRequestContext,
  input: EntityUpdateChange<T, D>
) {
  const { schema, db } = context;

  const entityName = input.entity as any as string;
  const idField = schema.getIdField(entityName)!;

  const pointer: EntityPointer = { entity: entityName, id: input.id };

  return await db.transaction(async (tr) => {
    unsafeAssertType<"update">(input.type);

    if (!(await getHasUserAccessTo(tr, pointer, context, "update"))) {
      throw new Error(`Not allowed to update ${entityName}`);
    }

    const updateQuery = tr
      .table(entityName)
      .update(input.data)
      .where(`${entityName}.${idField}`, "=", input.id);

    log.debug(updateQuery.toString());

    const results = await updateQuery;

    if (results === 0) {
      throw new Error(`Not allowed to update ${entityName}`);
    }
  });
}
