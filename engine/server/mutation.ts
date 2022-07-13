import { DbSchema } from "../schema/schema";
import { EntityChange } from "./change";
import { getIsChangeAllowed } from "./changePermission";
import { getIsChangeDataValid } from "./changeValidation";
import { SyncRequestContext } from "./context";

function getIdKeyForEntity(schema: DbSchema, entity: string) {
  const entitySchema = schema.entities.find((e) => e.name === entity);

  if (!entitySchema) {
    throw new Error(`Unknown entity ${entity}`);
  }

  return entitySchema.idField;
}

export async function performMutation(
  context: SyncRequestContext,
  input: EntityChange
): Promise<void> {
  const { schema, db } = context;

  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  if (!(await getIsChangeAllowed(context, input))) {
    throw new Error("Change is not allowed");
  }

  const idField = getIdKeyForEntity(schema, input.entity);

  switch (input.type) {
    case "remove": {
      db.table(input.entity).where(idField, input.id).delete();
      return;
    }
    case "update": {
      db.table(input.entity).where(idField, input.id).update(input.data);
      return;
    }
    case "create": {
      db.table(input.entity).insert(input.data);
      return;
    }
  }
}
