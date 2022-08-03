import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { pickFromRule } from "@clientdb/server/permissions/traverse";
import { buildWhereTree, RawWherePointer } from "./tree";

export function createPermissionWhereConditions<T>(
  rule: PermissionRuleModel<T>
) {
  const wherePointers = pickFromRule(rule, {
    onValue({ schemaPath, rule, conditionPath, selector, entity }) {
      const pointer: RawWherePointer = {
        conditionPath: conditionPath,
        condition: rule,
        selector: selector,
      };

      return pointer;
    },
  });

  const whereTree = buildWhereTree(wherePointers);

  return whereTree;
}
