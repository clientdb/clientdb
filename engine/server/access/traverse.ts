import { DbSchemaModel } from "../../schema/model";
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

interface TraverseRelationInfo {
  relation: RelationRule<any>;
  key: string;
  table: string;
  path: string[];
  conditionGroup: ConditionGroupSegment[];
}

interface TraverseValueInfo {
  value: WhereValueConfig<any>;
  key: string;
  table: string;
  path: string[];
  selectPath: string;
  conditionGroup: ConditionGroupSegment[];
}

interface TraverseCallbacks {
  onRelation?: (info: TraverseRelationInfo) => void;
  onValue?: (info: TraverseValueInfo) => void;
}

function joinPath(path: string[]) {
  return path.join("__");
}

function traverseRule<T>(
  aliasPath: string[],
  selectPath: string[],
  conditionGroup: ConditionGroupSegment[],
  table: string,
  rule: PermissionSelector<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  const { relationEntires, dataEntires } = parseWhereRule(rule, table, schema);

  for (const [key, fieldInfo] of dataEntires) {
    const keyPath = [...aliasPath, key as string];

    const value = resolveValueInput(fieldInfo);

    callbacks.onValue?.({
      key: key as string,
      table,
      path: keyPath,
      selectPath: `${joinPath(selectPath)}.${key as string}`,
      value: value,
      conditionGroup,
    });
  }

  for (const [relatedEntity, relationRule] of relationEntires) {
    const relationPath = [...aliasPath, relatedEntity as string];

    callbacks.onRelation?.({
      key: relatedEntity as string,
      path: relationPath,
      relation: relationRule,
      table,
      conditionGroup,
    });

    traversePermissionsWithPath(
      relationPath,
      relationPath,
      conditionGroup,
      relatedEntity as string,
      relationRule,
      schema,
      callbacks
    );
  }
}

function traversePermissionsWithPath<T>(
  aliasPath: string[],
  selectPath: string[],
  conditionGroup: ConditionGroupSegment[],
  entity: string,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel,
  callbacks: TraverseCallbacks
) {
  const { rule, $and = [], $or = [] } = parseWherePermission(permissions);

  traverseRule(
    aliasPath,
    selectPath,
    conditionGroup,
    entity,
    rule,
    schema,
    callbacks
  );

  $and
    .map((andRule, index) => {
      return traversePermissionsWithPath(
        [...aliasPath, `and`, `${index}`],
        selectPath,
        [...conditionGroup, `and`, index],
        entity,
        andRule,
        schema,
        callbacks
      );
    })
    .flat();

  $or
    .map((orRule, index) => {
      return traversePermissionsWithPath(
        [...aliasPath, `or`, `${index}`],
        selectPath,
        [...conditionGroup, `or`, index],
        entity,
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
    [entity],
    [entity],
    [],
    entity,
    permissions,
    schema,
    callbacks
  );
}
