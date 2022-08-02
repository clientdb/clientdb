import { EntityChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { createLogger } from "@clientdb/server/utils/logger";
import { getIsKnownError } from "../error";
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
    if (!getIsKnownError(error)) {
      log.error("Failed to perform mutation", input, error);
    } else {
      log.verbose("Failed to perform mutation", input, error);
    }

    throw error;
  }
}
