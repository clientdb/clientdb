import { DbSchemaModel } from "../../schema/model";
import { PermissionRule, WhereValueConfig } from "../../schema/types";
import { getIsWhereValueConfigConstant } from "../../schema/utils";
import { ConditionGroupSegment, traversePermissions } from "./traverse";
import { insertAtIndexIfDoesntExist, iterateWithPrevious } from "./utils";

export interface WhereTree {
  conditions: WherePointer[];
  and: WhereTree[];
  or: WhereTree[];
}

export interface WherePointer {
  select: string;
  config: WhereValueConfig<any>;
}

interface RawWherePointer extends WherePointer {
  conditionGroup: ConditionGroupSegment[];
}

function createWhereTree(): WhereTree {
  return { conditions: [], and: [], or: [] };
}

function getConditionTargetTree(pointer: RawWherePointer, root: WhereTree) {
  const { conditionGroup } = pointer;

  if (!conditionGroup.length) {
    return root;
  }

  let currentLeaf = root;

  for (const [segment, previousSegment] of iterateWithPrevious(
    conditionGroup
  )) {
    if (typeof segment !== "number") continue;

    if (typeof previousSegment !== "string") {
      throw new Error("Invalid condition group");
    }

    if (previousSegment === "and") {
      currentLeaf = insertAtIndexIfDoesntExist(
        currentLeaf.and,
        segment,
        createWhereTree
      );
    }

    if (previousSegment === "or") {
      currentLeaf = insertAtIndexIfDoesntExist(
        currentLeaf.or,
        segment,
        createWhereTree
      );
    }
  }

  return currentLeaf;
}

function pushWherePointer(pointer: RawWherePointer, tree: WhereTree) {
  const { conditionGroup } = pointer;

  getConditionTargetTree(pointer, tree).conditions.push({
    select: pointer.select,
    config: pointer.config,
  });
}

function parseWhereTree(pointers: RawWherePointer[]): WhereTree {
  const root = createWhereTree();

  for (const pointer of pointers) {
    pushWherePointer(pointer, root);
  }

  return root;
}

export function createWhereConditions<T>(
  entity: string,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel
) {
  const wherePointers: RawWherePointer[] = [];

  traversePermissions(entity, permissions, schema, {
    onValue({ schemaPath, value, conditionPath, field }) {
      const pointer: RawWherePointer = {
        conditionGroup: conditionPath,
        config: value,
        select: `${schemaPath.join("__")}.${field}`,
      };

      wherePointers.push(pointer);
    },
  });

  return parseWhereTree(wherePointers);
}
