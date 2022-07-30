import { EntityChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "../context";
import { createLogger } from "../utils/logger";
import { getIsChangeDataValid } from "./changeValidation";
import { performCreate } from "./create";
import { performRemove } from "./remove";
import { performUpdate } from "./update";

const log = createLogger("Mutation");

export async function performMutation<T, D>(
  context: SyncRequestContext,
  input: EntityChange<T, D>
): Promise<void> {
  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  log.debug("Performing mutation", input);

  try {
    switch (input.type) {
      case "remove": {
        await performRemove(context, input);
        return;
      }
      case "update": {
        await performUpdate(context, input);
        return;
      }
      case "create": {
        await performCreate(context, input);
        return;
      }
    }
  } catch (error) {
    log.debug("Failed to perform mutation", input, error);
    throw error;
  }
}
