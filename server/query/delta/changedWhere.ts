import { EntityPointer } from "@clientdb/server/entity/pointer";
import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { pickFromRule } from "@clientdb/server/permissions/traverse";
import { buildWhereTree, RawWherePointer } from "../where/tree";

export function getChangedEntityPointerWhere(
  changed: EntityPointer,
  rule: PermissionRuleModel
) {
  const changedIdField = rule.$schema.getIdField(changed.entity);

  if (!changedIdField) {
    throw new Error(`changedEntity entity ${changed.entity} has no id field.`);
  }

  const idSelectors = pickFromRule<RawWherePointer>(rule, {
    onRelation({ entity, selector }) {
      if (entity !== changed.entity) return;

      return {
        condition: {
          $eq: changed.id,
        },
        conditionPath: [],
        selector: `${selector}.${changedIdField}`,
      };
    },
    onValue({ referencedEntity, selector }) {
      if (referencedEntity === changed.entity) {
        return {
          condition: {
            $eq: changed.id,
          },
          conditionPath: [],
          selector: selector,
        };
      }
    },
  });

  const anyIdMatchingSelectors = idSelectors.map(
    (selector, index): RawWherePointer => {
      return {
        ...selector,
        conditionPath: ["or", index],
      };
    }
  );

  const whereTree = buildWhereTree(anyIdMatchingSelectors);

  return whereTree;
}
