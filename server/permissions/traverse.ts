import {
  DbSchemaModel,
  SchemaEntity,
  SchemaEntityRelation,
} from "@clientdb/schema";
import { parseWhereRule } from "./ruleParser";
import {
  ConditionGroupSegment,
  PermissionRule,
  PermissionSelector,
  RelationRule,
  WhereValueConfig,
} from "./types";
import { resolveValueInput } from "./value";

interface TraverseStepInfo {
  schemaPath: string[];
  conditionPath: ConditionGroupSegment[];
  field: string;
  table: string;
}

export interface TraverseRelationInfo extends TraverseStepInfo {
  rule: RelationRule<any>;
  relation: SchemaEntityRelation;
  targetEntity: SchemaEntity;
}

export interface TraverseValueInfo extends TraverseStepInfo {
  value: WhereValueConfig<any>;
}

export interface TraverseLevelInfo extends TraverseStepInfo {
  level: PermissionSelector<any>;
}

interface TraverseCallbacks<R = void> {
  onRelation?: (info: TraverseRelationInfo) => R;
  onValue?: (info: TraverseValueInfo) => R;
  onLevel?: (info: TraverseLevelInfo) => R;
}

function traverseRule<T>(
  info: TraverseStepInfo,
  rule: PermissionSelector<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  callbacks?.onLevel?.({ ...info, level: rule });

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
  inputRule: PermissionRule<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  traverseRule(info, inputRule, schema, callbacks);

  inputRule.$and
    ?.map((andRule, index) => {
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

  inputRule.$or
    ?.map((orRule, index) => {
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

export function traversePermissions(
  entity: string,
  rule: PermissionRule<unknown>,
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
    rule,
    schema,
    callbacks
  );
}

export function mapPermissions<R>(
  entity: string,
  permissions: PermissionRule<unknown>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks<R | undefined | void>
) {
  const results: R[] = [];

  traversePermissions(entity, permissions, schema, {
    onValue(info) {
      if (callbacks.onValue) {
        const result = callbacks.onValue(info);

        if (result !== undefined) {
          results.push(result);
        }
      }
    },
    onRelation(info) {
      if (callbacks.onRelation) {
        const result = callbacks.onRelation(info);

        if (result !== undefined) {
          results.push(result);
        }
      }
    },
  });

  return results;
}

export function getHasPermission<R>(
  entity: string,
  permissions: PermissionRule<unknown>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks<boolean>
) {
  let hasSome = false;

  traversePermissions(entity, permissions, schema, {
    onValue(info) {
      if (hasSome) return;

      if (!callbacks.onValue) return;

      hasSome = callbacks.onValue(info);
    },
    onRelation(info) {
      if (hasSome) return;

      if (!callbacks.onRelation) return;

      hasSome = callbacks.onRelation(info);
    },
  });

  return hasSome;
}
