import { SyncRequestContext } from "@clientdb/server/context";
import { doesValueMatchValueConfig } from "@clientdb/server/permissions/compareValue";
import { filterRule } from "@clientdb/server/permissions/filterRule";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import {
  getRuleHas,
  TraverseValueInfo,
} from "@clientdb/server/permissions/traverse";
import { Changes } from "@clientdb/server/utils/changes";

function getChangeImpactOnRule(
  entity: string,
  changes: Changes<any>,
  info: TraverseValueInfo
) {
  if (info.entity !== entity) return null;

  const changeInfo = changes[info.field];

  if (changeInfo === undefined) return null;

  const [valueBefore, valueNow] = changeInfo;

  const didMatch = doesValueMatchValueConfig(valueBefore, info.rule);
  const doesMatch = doesValueMatchValueConfig(valueNow, info.rule);

  if (didMatch === doesMatch) return null;

  if (didMatch) {
    // Did stop matching
    return false;
  }

  // Did start matching
  return true;
}

export function getUpdateDelta(
  entity: string,
  changes: Changes<any>,
  context: SyncRequestContext
) {
  const rule = pickPermissionsRule(context.permissions, entity, "read");

  if (!rule) return null;

  const enabledRules = filterRule(
    rule,
    entity,
    (rule, ruleEntity) => {
      return getRuleHas(ruleEntity, rule, context.schema, {
        onValue(info) {
          return getChangeImpactOnRule(entity, changes, info) === true;
        },
      });
    },
    context.schema
  );

  const disabledRules = filterRule(
    rule,
    entity,
    (rule, ruleEntity) => {
      return getRuleHas(ruleEntity, rule, context.schema, {
        onValue(info) {
          return getChangeImpactOnRule(entity, changes, info) === true;
        },
      });
    },
    context.schema
  );

  filterRule;
}
