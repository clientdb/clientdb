import { DbSchemaModel } from "../../schema/model";
import { SchemaEntity, SchemaEntityRelation } from "../../schema/schema";
import {
  RelationRule,
  PermissionRule,
  PermissionSelector,
  WhereValue,
  WhereValueConfig,
} from "../../schema/types";
import { resolveValueInput } from "../../schema/utils";
import { parseWherePermission, parseWhereRule } from "./utils";

export type ConditionGroupSegment = "and" | "or" | number;

interface TraverseStepInfo {
  schemaPath: string[];
  conditionPath: ConditionGroupSegment[];
  field: string;
  table: string;
}

interface TraverseRelationInfo extends TraverseStepInfo {
  rule: RelationRule<any>;
  relation: SchemaEntityRelation;
  targetEntity: SchemaEntity;
}

interface TraverseValueInfo extends TraverseStepInfo {
  value: WhereValueConfig<any>;
}

interface TraverseCallbacks {
  onRelation?: (info: TraverseRelationInfo) => void;
  onValue?: (info: TraverseValueInfo) => void;
}

function traverseRule<T>(
  info: TraverseStepInfo,
  rule: PermissionSelector<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  const { relationEntires, dataEntires } = parseWhereRule(
    rule,
    info.table,
    schema
  );

  for (const [key, fieldInfo] of dataEntires) {
    const value = resolveValueInput(fieldInfo);

    callbacks.onValue?.({
      ...info,
      field: key as string,
      value: value,
    });
  }

  for (const [relationField, relationRule] of relationEntires) {
    const relation = schema.getRelation(info.table, relationField as string)!;
    const targetEntity = schema.getFieldTargetEntity(
      info.table,
      relationField as string
    );

    if (!targetEntity) {
      throw new Error(
        `No target entity for relation ${relationField as string} in entity ${
          info.table
        }`
      );
    }

    callbacks.onRelation?.({
      ...info,
      field: relationField as string,
      rule: relationRule,
      relation,
      targetEntity,
    });

    traversePermissionsWithPath(
      {
        ...info,
        schemaPath: [...info.schemaPath, relationField as string],
        field: relationField as string,
        table: targetEntity.name,
      },
      relationRule,
      schema,
      callbacks
    );
  }
}

function traversePermissionsWithPath<T>(
  info: TraverseStepInfo,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  const { rule, $and = [], $or = [] } = parseWherePermission(permissions);

  traverseRule(info, rule, schema, callbacks);

  $and
    .map((andRule, index) => {
      return traversePermissionsWithPath(
        {
          ...info,
          conditionPath: [...info.conditionPath, "and", index],
        },
        andRule,
        schema,
        callbacks
      );
    })
    .flat();

  $or
    .map((orRule, index) => {
      return traversePermissionsWithPath(
        {
          ...info,
          conditionPath: [...info.conditionPath, "or", index],
        },
        orRule,
        schema,
        callbacks
      );
    })
    .flat();
}

export function traversePermissions<T>(
  entity: string,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  return traversePermissionsWithPath(
    {
      schemaPath: [entity],
      conditionPath: [],
      field: "",
      table: entity,
    },
    permissions,
    schema,
    callbacks
  );
}
