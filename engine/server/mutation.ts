import { DbSchema } from "../schema/schema";
import { EntityChange } from "./change";
import { getIsChangeAllowed } from "./changePermission";
import { getIsChangeDataValid } from "./changeValidation";
import { SyncRequestContext } from "./context";

export async function performMutation<T, D>(
  context: SyncRequestContext,
  input: EntityChange<T, D>
): Promise<void> {
  const { schema, db } = context;

  const entityName = input.entity as any as string;

  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  if (!(await getIsChangeAllowed(context, input))) {
    throw new Error("Change is not allowed");
  }

  const idField = schema.getIdField(entityName)!;

  switch (input.type) {
    case "remove": {
      await db.table(entityName).where(idField, input.id).delete();
      return;
    }
    case "update": {
      await db.table(entityName).where(idField, input.id).update(input.data);
      return;
    }
    case "create": {
      await db.table(entityName).insert(input.data);
      return;
    }
  }
}
