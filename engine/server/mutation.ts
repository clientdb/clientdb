import { DbSchema } from "../schema/schema";
import { createLogger } from "../utils/logger";
import { createEntitiesAccessedThanksTo } from "./access/delta/query";
import { createAccessQuery } from "./access/query";
import { EntityChange } from "./change";
import { getIsChangeAllowed } from "./changePermission";
import { getIsChangeDataValid } from "./changeValidation";
import { SyncRequestContext } from "./context";

const log = createLogger("Mutation");

export async function performMutation<T, D>(
  context: SyncRequestContext,
  input: EntityChange<T, D>
): Promise<void> {
  const { schema, db } = context;

  const entityName = input.entity as any as string;

  if (!getIsChangeDataValid(context, input)) {
    throw new Error("Invalid change data");
  }

  const idField = schema.getIdField(entityName)!;

  switch (input.type) {
    case "remove": {
      const accessQuery = createAccessQuery(context, entityName, "remove")!;

      if (!accessQuery) {
        throw new Error("No access query found");
      }

      const updateQuery = db
        .table(entityName)
        .delete()
        .andWhere(`${entityName}.${idField}`, "=", input.id)
        .andWhere(`${entityName}.${idField}`, "in", accessQuery);

      log(updateQuery.toString());
      const results = await updateQuery;

      if (results === 0) {
        throw new Error("Not allowed to delete");
      }
      return;
    }
    case "update": {
      const accessQuery = createAccessQuery(context, entityName, "update")!;
      const updateQuery = db
        .table(entityName)
        .update(input.data)
        .andWhere(`${entityName}.${idField}`, "=", input.id)
        .andWhere(`${entityName}.${idField}`, "in", accessQuery);

      log(updateQuery.toString());

      const results = await updateQuery;

      if (results === 0) {
        throw new Error("Not allowed to update");
      }
      return;
    }
    case "create": {
      await db.table(entityName).insert(input.data);

      if (input.data.id) {
        const delta = createEntitiesAccessedThanksTo(
          { entity: entityName, id: input.data.id },
          context
        );

        log(`create delta of ${entityName}`, entityName, input.data.id);

        log(delta.toString());
      }
      return;
    }
  }
}
