import { EntityCreateChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "../context";
import { EntityPointer } from "../entity/pointer";
import { unsafeAssertType } from "../utils/assert";
import { createLogger } from "../utils/logger";
import { insertDeltaForChange } from "./delta";
import { getHasUserAccessTo } from "./entity";

const log = createLogger("Mutation");

export async function performCreate<T, D>(
  context: SyncRequestContext,
  input: EntityCreateChange<T, D>
) {
  const { schema, db } = context;

  const entityName = input.entity as any as string;
  const idField = schema.getIdField(entityName)!;

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

    const createdEntityPointer: EntityPointer = { entity: entityName, id };

    if (
      !(await getHasUserAccessTo(tr, createdEntityPointer, context, "create"))
    ) {
      throw new Error(`Not allowed to create ${entityName}`);
    }

    await insertDeltaForChange(tr, createdEntityPointer, context, "put");

    log.debug(`create delta of ${entityName}`, entityName, id);

    return;
  });
}
