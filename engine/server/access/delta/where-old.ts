import { Knex } from "knex";
import { applyQueryWhere } from "../../../utils/conditions/builder";
import {
  parseWhereTree,
  RawWherePointer,
} from "../../../utils/conditions/conditions";
import { pickPermissionsRule } from "../../change";
import { SyncRequestContext } from "../../context";
import { mapPermissions } from "../../permissions/traverse";
import { getIsRelationImpactedBy } from "./relation";

function createExactEntityWhereComparsion(
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext,
  compare: "=" | "!="
) {
  const accessRules = pickPermissionsRule(
    context.permissions,
    impactedEntity,
    "read"
  );

  if (!accessRules) {
    throw new Error(`Impacted entity ${impactedEntity} has no access rules.`);
  }

  const idField = context.schema.getIdField(changedEntity);

  if (!idField) {
    throw new Error(`Impacted entity ${impactedEntity} has no id field.`);
  }

  const whereAccessedThanksTo = mapPermissions<RawWherePointer>(
    impactedEntity,
    accessRules,
    context.schema,
    {
      onValue({ table, field, conditionPath, schemaPath, value }) {
        const referencedEntity = context.schema.getEntityReferencedBy(
          table,
          field
        );

        if (referencedEntity?.name === context.config.userTable) {
          // return;
          const pointer: RawWherePointer = {
            table: table,
            conditionPath: conditionPath,
            condition: { $isNull: false },
            select: `${schemaPath.join("__")}.${field}`,
          };

          return pointer;
        }

        const pointer: RawWherePointer = {
          table: table,
          conditionPath: conditionPath,
          condition: value,
          select: `${schemaPath.join("__")}.${field}`,
        };

        return pointer;
      },
      onRelation({ relation, schemaPath, field, conditionPath, table }) {
        const isImpacted = getIsRelationImpactedBy(relation, changedEntity);

        if (!isImpacted) return;

        const pointer: RawWherePointer = {
          table,
          conditionPath,
          select: `${[...schemaPath, field].join("__")}.${idField}`,
          condition:
            compare === "="
              ? {
                  $eq: changedEntityId,
                }
              : {
                  $ne: changedEntityId,
                },
        };

        return pointer;
      },
    }
  );

  if (changedEntity === impactedEntity) {
    whereAccessedThanksTo.push({
      condition: { $eq: changedEntityId },
      conditionPath: [],
      select: `${changedEntity}.${idField}`,
      table: changedEntity,
    });
  }

  const thanksToWhereTree = parseWhereTree(whereAccessedThanksTo);

  return thanksToWhereTree;
}

function createExactEntityWhere(
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  const thanksToWhereTree = createExactEntityWhereComparsion(
    impactedEntity,
    changedEntity,
    changedEntityId,
    context,
    "="
  );

  const evenWithoutWhereTree = createExactEntityWhereComparsion(
    impactedEntity,
    changedEntity,
    changedEntityId,
    context,
    "!="
  );

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

  query = query.andWhere((qb) => {
    applyQueryWhere(qb, thanksToWhereTree, context);
  });

  if (changedEntity !== impactedEntity) {
    query = query.andWhereNot((qb) => {
      applyQueryWhere(qb, evenWithoutWhereTree, context);
    });
  }

  return query;
}