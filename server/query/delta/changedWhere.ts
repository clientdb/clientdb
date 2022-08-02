import { EntityPointer } from "@clientdb/server/entity/pointer";
import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { pickFromRule } from "@clientdb/server/permissions/traverse";
import { parseWhereTree, RawWherePointer } from "../where/tree";

export function createChangedEntityWhere(
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
        select: `${selector}.${changedIdField}`,
      };
    },
    onValue({ referencedEntity, selector }) {
      if (referencedEntity === changed.entity) {
        return {
          condition: {
            $eq: changed.id,
          },
          conditionPath: [],
          select: selector,
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

  const whereTree = parseWhereTree(anyIdMatchingSelectors);

  return whereTree;
}
