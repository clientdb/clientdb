import { EntityCreateChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { unsafeAssertType } from "@clientdb/server/utils/assert";
import { createLogger, logAll } from "@clientdb/server/utils/logger";
import { UnauthorizedError } from "../error";
import { AccessQueryBuilder } from "../permissions/AccessQueryBuilder";
import { EntityAddedOrRemovedDeltaBuilder } from "../permissions/EntityAddedOrRemovedDeltaBuilder";
import { explainQuery } from "../query/explain";
import { timer } from "../utils/timer";
// import { insertDeltaForChange } from "./delta";

const log = createLogger("Mutation");

export async function performCreate<T, D>(
  context: SyncRequestContext,
  input: EntityCreateChange<T, D>
) {
  const { schema, db, permissions } = context;

  const entityName = input.entity as any as string;
  const idField = schema.assertEntity(entityName).idField!;

  const rule = permissions.assertPermissionRule(entityName, "create");

  const accessQuery = new AccessQueryBuilder(rule, context);

  await db.transaction(async (tr) => {
    unsafeAssertType<"create">(input.type);

    const result = await tr
      .table(entityName)
      .insert(input.data)
      .returning(idField);

    if (result.length === 0) {
      throw new Error(`Not allowed to create ${entityName}`);
    }

    const id = result[0][idField]!;

    if (!(await accessQuery.canUserAccess(tr, id))) {
      throw new UnauthorizedError(`Not allowed to create ${entityName}`);
    }

    try {
      const deltaQuery = new EntityAddedOrRemovedDeltaBuilder(
        { id, entity: entityName },
        context
      );

      await deltaQuery.insert(tr, "put", context);
    } catch (error) {
      log.error(`Error inserting create delta for ${entityName}`, input, error);
    }

    log.debug(`created delta of ${entityName}`, entityName, id);

    return;
  });
}
