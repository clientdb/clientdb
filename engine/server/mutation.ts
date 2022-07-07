import { EntityChange } from "./change";
import { getIsChangeAllowed } from "./changePermission";
import { getIsChangeDataValid } from "./changeValidation";
import { SyncRequestContext } from "./context";

export async function performMutation(
  context: SyncRequestContext,
  input: EntityChange
): Promise<void> {
  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  if (!(await getIsChangeAllowed(context, input))) {
    throw new Error("Change is not allowed");
  }

  switch (input.type) {
    case "remove":
      return await context.connector.delete(input.entity, input.id);
    case "update":
      return await context.connector.update(input.entity, input.id, input.data);
    case "create":
      return await context.connector.create(input.entity, input.data);
  }
}
