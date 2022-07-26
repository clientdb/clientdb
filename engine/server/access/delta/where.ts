import { Knex } from "knex";
import { applyQueryWhere } from "../../../utils/conditions/builder";
import {
  parseWhereTree,
  RawWherePointer,
} from "../../../utils/conditions/conditions";
import { pickPermissionsRules } from "../../change";
import { SyncRequestContext } from "../../context";
import { mapPermissions } from "../../permissions/traverse";
import { getIsRelationImpactedBy } from "./relation";

function createExactEntityWhere(
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  const accessRules = pickPermissionsRules(context, impactedEntity, "read");

  if (!accessRules) {
    throw new Error(`Impacted entity ${impactedEntity} has no access rules.`);
  }

  const whereAccessedThanksTo = mapPermissions<RawWherePointer>(
    impactedEntity,
    accessRules,
    context.schema,
    {
      onRelation({ relation, schemaPath, field, conditionPath }) {
        const isImpacted = getIsRelationImpactedBy(relation, changedEntity);

        if (!isImpacted) return;

        const pointer: RawWherePointer = {
          conditionPath,
          select: `${schemaPath.join("__")}.${field}`,
          config: {
            $eq: changedEntityId,
          },
        };

        return pointer;
      },
    }
  );

  const thanksToWhereTree = parseWhereTree(whereAccessedThanksTo);

  const whereAccessedEvenWithout = mapPermissions<RawWherePointer>(
    impactedEntity,
    accessRules,
    context.schema,
    {
      onRelation({ relation, schemaPath, field, conditionPath }) {
        const isImpacted = getIsRelationImpactedBy(relation, changedEntity);

        if (!isImpacted) return;

        const pointer: RawWherePointer = {
          conditionPath,
          select: `${schemaPath.join("__")}.${field}`,
          config: {
            $ne: changedEntityId,
          },
        };

        return pointer;
      },
    }
  );

  const evenWithoutWhereTree = parseWhereTree(whereAccessedEvenWithout);

  return {
    thanksToWhereTree,
    evenWithoutWhereTree,
  };
}

export function applyExactEntityWhere(
  query: Knex.QueryBuilder,
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  const { thanksToWhereTree, evenWithoutWhereTree } = createExactEntityWhere(
    impactedEntity,
    changedEntity,
    changedEntityId,
    context
  );

  query = query
    .andWhere((qb) => {
      applyQueryWhere(qb, thanksToWhereTree, context);
    })
    .andWhere((qb) => {
      applyQueryWhere(qb, evenWithoutWhereTree, context);
    });

  return query;
}
