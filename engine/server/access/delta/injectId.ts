import { DbSchemaModel } from "../../../schema/model";
import { PermissionRule } from "../../../schema/types";
import { traversePermissions } from "../../permissions/traverse";

interface Input {
  entity: string;
  changedEntity: string;
  id: string;
  rule: PermissionRule;
  schema: DbSchemaModel;
}

export function injectIdToPermissionRule({
  entity,
  changedEntity,
  id,
  rule,
  schema,
}: Input): PermissionRule {
  const clonedRule = deepClone(rule);

  const changedEntityIdField = schema.getIdField(changedEntity);

  if (!changedEntityIdField) {
    throw new Error(`changedEntity entity ${changedEntity} has no id field.`);
  }

  // if (changedEntity === entity) {
  //   const existingRule = Reflect.get(clonedRule, changedEntityIdField);

  //   if (existingRule === undefined) {
  //     Reflect.set(clonedRule, changedEntityIdField, id);
  //   } else {
  //     console.debug("Existing permission", { existingRule });
  //   }
  // }

  traversePermissions(entity, clonedRule, schema, {
    onLevel({ table, level }) {
      if (table !== changedEntity) return;

      const existingRule = Reflect.get(level, changedEntityIdField);

      if (existingRule !== undefined) {
        console.debug("Existing permission", { existingRule });
        return;
      }

      Reflect.set(level, changedEntityIdField, id);
    },
  });

  // if (changedEntity === entity) {
  //   return { [changedEntityIdField]: id, $and: [clonedRule] };
  // }

  return clonedRule;
}

function deepClone<T>(input: T): T {
  if (typeof input === "function") {
    return input;
  }

  if (typeof input !== "object" || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return (input as any).map(deepClone);
  }

  const result: any = {};

  for (const key in input) {
    result[key] = deepClone(input[key]);
  }

  return result;
}
