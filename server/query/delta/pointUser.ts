import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import {
  pickFromRule,
  TraverseValueInfo,
} from "@clientdb/server/permissions/traverse";
import { resolveValuePointer } from "@clientdb/server/permissions/value";
import {
  buildWhereTree,
  RawWherePointer,
} from "@clientdb/server/query/where/tree";

function getIsFieldPoinintToCurrentUser(
  info: TraverseValueInfo,
  context: SyncRequestContext
) {
  const userTable = context.config.userTable;

  if (info.referencedEntity !== userTable) return false;

  if (!info.rule.$eq) return false;

  const injectedIdToCheck = "<<id>>";

  const fakeContext: SyncRequestContext = {
    ...context,
    userId: injectedIdToCheck,
  };

  const resolvedValue = resolveValuePointer<string>(info.rule.$eq, fakeContext);

  return resolvedValue === injectedIdToCheck;
}

export function getRuleWhereMappingToAllowedUsers(
  entity: string,
  changed: EntityPointer,
  rule: PermissionRuleModel<any>,
  context: SyncRequestContext
) {
  const idField = context.schema.getIdField(changed.entity);

  if (!idField) {
    throw new Error(`Impacted entity ${entity} has no id field.`);
  }

  const deltaWherePointers = pickFromRule<RawWherePointer>(rule, {
    onValue(info) {
      const { selector, conditionPath, schemaPath, rule } = info;

      if (getIsFieldPoinintToCurrentUser(info, context)) {
        const pointer: RawWherePointer = {
          conditionPath: conditionPath,
          condition: `allowed_user.id`,
          selector: selector,
        };

        return pointer;
      }

      const pointer: RawWherePointer = {
        conditionPath: conditionPath,
        condition: rule,
        selector: selector,
      };

      return pointer;
    },
  });

  const deltaWhereTree = buildWhereTree(deltaWherePointers);

  return deltaWhereTree;
}
