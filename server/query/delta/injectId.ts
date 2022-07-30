import { DbSchemaModel } from "@clientdb/schema";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { traversePermissions } from "@clientdb/server/permissions/traverse";
import { PermissionRule } from "@clientdb/server/permissions/types";
import { log } from "@clientdb/server/utils/logger";

interface Input {
  entity: string;
  changed: EntityPointer;
  rule: PermissionRule;
  schema: DbSchemaModel;
}

export function selectChangedEntityInRule({
  entity,
  changed,
  rule,
  schema,
}: Input): PermissionRule {
  const clonedRule = deepClone(rule);

  const changedEntityIdField = schema.getIdField(changed.entity);

  if (!changedEntityIdField) {
    throw new Error(`changedEntity entity ${changed.entity} has no id field.`);
  }

  traversePermissions(entity, clonedRule, schema, {
    onLevel({ table, level }) {
      if (table !== changed.entity) return;

      const existingRule = Reflect.get(level, changedEntityIdField);

      if (existingRule !== undefined) {
        log.debug("Existing permission", {
          existingRule,
          entity,
          changed,
          changedEntityIdField,
        });
        return;
      }

      Reflect.set(level, changedEntityIdField, changed.id);
    },
  });

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
