import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { pickFromRule } from "@clientdb/server/permissions/traverse";
import { parseWhereTree, RawWherePointer } from "./tree";

export function createPermissionWhereConditions<T>(
  rule: PermissionRuleModel<T>
) {
  const wherePointers = pickFromRule(rule, {
    onValue({ schemaPath, rule, conditionPath, selector, entity }) {
      const pointer: RawWherePointer = {
        conditionPath: conditionPath,
        condition: rule,
        select: selector,
      };

      return pointer;
    },
  });

  const whereTree = parseWhereTree(wherePointers);

  return whereTree;
}
