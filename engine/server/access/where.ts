import { DbSchemaModel } from "../../schema/model";
import { WherePermission, WhereValueConfig } from "../../schema/types";
import { getIsWhereValueConfigConstant } from "../../schema/utils";
import { ConditionGroupSegment, traversePermissions } from "./traverse";

function getIsFieldPointingToUserId(
  table: string,
  field: string,
  schema: DbSchemaModel,
  userTable: string
) {
  const userIdField = schema.getIdField(userTable);

  if (!userIdField) {
    throw new Error(`User table ${userTable} has no id field`);
  }

  if (table === userTable && field === userIdField) {
    return true;
  }

  const maybeUserEntity = schema.getEntityReferencedBy(table, field);

  return maybeUserEntity?.name === userTable;
}

export interface WhereTree {
  conditions?: WherePointer[];
  and?: WhereTree[];
  or?: WhereTree[];
}

export interface WherePointer {
  select: string;
  config: WhereValueConfig<any>;
}

interface RawWherePointer extends WherePointer {
  conditionGroup: ConditionGroupSegment[];
}

function createWhereTree(): WhereTree {
  return {};
}

function pushWherePointer(pointer: RawWherePointer, tree: WhereTree) {
  const { conditionGroup } = pointer;

  if (!conditionGroup.length) {
    tree.conditions = tree.conditions || [];
    tree.conditions.push({
      config: pointer.config,
      select: pointer.select,
    });
    return;
  }

  let currentLeaf = tree;

  for (const segment of conditionGroup) {
    if (segment === "and") {
      const newLeaf = createWhereTree();
      if (!currentLeaf.and) {
        currentLeaf.and = [];
      }
      currentLeaf.and.push(newLeaf);
      currentLeaf = newLeaf;
      continue;
    }

    if (segment === "or") {
      const newLeaf = createWhereTree();
      if (!currentLeaf.or) {
        currentLeaf.or = [];
      }

      currentLeaf.or.push(newLeaf);
      currentLeaf = newLeaf;
      continue;
    }

    if (!currentLeaf.conditions) {
      currentLeaf.conditions = [];
    }

    currentLeaf.conditions.push({
      config: pointer.config,
      select: pointer.select,
    });
  }
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
  permissions: WherePermission<T>,
  schema: DbSchemaModel
) {
  const constantWhere: RawWherePointer[] = [];
  const dynamicWhere: RawWherePointer[] = [];

  traversePermissions(entity, permissions, schema, {
    onValue({ key, table, selectPath, value, conditionGroup }) {
      const isConstant = getIsWhereValueConfigConstant(value);

      if (isConstant) {
        constantWhere.push({
          select: selectPath,
          config: value,
          conditionGroup,
        });
      } else {
        dynamicWhere.push({
          select: selectPath,
          config: value,
          conditionGroup,
        });
      }
    },
  });

  return [parseWhereTree(constantWhere), parseWhereTree(dynamicWhere)] as const;
}
