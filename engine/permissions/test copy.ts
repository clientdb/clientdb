import { Knex, knex } from "knex";
import { DbSchemaModel } from "../schema/model";
import { DbSchema, SchemaEntityRelation } from "../schema/schema";

type QueryBuilder = Knex.QueryBuilder<any, any>;

type PermissionOperationType = "read" | "write" | "delete";

interface PermissionRelationConfig {
  some?: PermissionConfig;
  every?: PermissionConfig;
  none?: PermissionConfig;
}

interface PermissionValueConfig {
  $eq?: any;
  $ne?: any;
  $gt?: any;
  $gte?: any;
  $lt?: any;
  $lte?: any;
  $in?: any[];
  $nin?: any[];
}

function getIsValueConfig(input: unknown): input is PermissionValueConfig {
  const typed = input as PermissionValueConfig;

  if (!typed) return false;

  const { $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin } = typed;

  return [$eq, $ne, $gt, $gte, $lt, $lte, $in, $nin].some((value) => {
    return value !== undefined;
  });
}

function getIsRelationConfig(
  input: unknown
): input is PermissionRelationConfig {
  const typed = input as PermissionRelationConfig;

  if (!typed) return false;

  const { some, every, none } = typed;

  return [some, every, none].some((value) => {
    return value !== undefined;
  });
}

type PermissionFieldConfig =
  | PermissionValueConfig
  | PermissionRelationConfig
  | PermissionConfig;

interface PermissionFields {
  [key: string]: PermissionFieldConfig;
}

type PermissionConfig = {
  $or?: PermissionConfig[];
  $and?: PermissionConfig[];
} & PermissionFields;

interface PermissionSchema {
  operation: PermissionOperationType;
  table: string;
  config: PermissionConfig;
}

function pickRequiredPermissionRelationsForJoins(
  permissionSchema: PermissionSchema,
  schema: DbSchemaModel
) {
  const { config, table } = permissionSchema;

  const { $or, $and, ...fields } = config;

  const relations: SchemaEntityRelation[] = [];

  for (const [key, fieldConfig] of Object.entries(fields)) {
    if (!getIsRelationConfig(fieldConfig)) continue;

    const relation = schema.getRelation(table, key);

    if (!relation) {
      throw new Error(`Relation ${key} of table ${table} not found in schema`);
    }

    relations.push(relation);
  }

  return relations;
}

function getRootQueryWithJoins(
  permissionSchema: PermissionSchema,
  schema: DbSchemaModel
): QueryBuilder {
  const { table } = permissionSchema;

  const tableSchema = schema.getEntity(table)!;

  const relations = pickRequiredPermissionRelationsForJoins(
    permissionSchema,
    schema
  );

  const query = db(table).select("*");

  return relations.reduce((query, relation) => {
    if (relation.type === "collection") {
      return query.innerJoin(
        table,
        relation.referencedByEntity,
        `${relation.referencedByEntity}.${relation.referencedByField} = ${table}.${tableSchema.idField}`
      );
    }

    if (relation.type === "reference") {
      return query.innerJoin(
        table,
        relation.referencedEntity,
        `${relation.referencedEntity}.${relation.referenceField} = ${table}.${tableSchema.idField}`
      );
    }

    throw new Error(`Unknown relation type`);
  }, query);
}

function applyFieldValueWhere(
  field: string,
  config: PermissionValueConfig,
  qb: QueryBuilder
) {
  const { $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin } = config;

  if ($eq !== undefined) {
    qb.where(field, "=", $eq);
  }

  if ($ne !== undefined) {
    qb.where(field, "!=", $ne);
  }

  if ($gt !== undefined) {
    qb.where(field, ">", $gt);
  }

  if ($gte !== undefined) {
    qb.where(field, ">=", $gte);
  }

  if ($lt !== undefined) {
    qb.where(field, "<", $lt);
  }

  if ($lte !== undefined) {
    qb.where(field, "<=", $lte);
  }

  if ($in !== undefined) {
    qb.whereIn(field, $in);
  }

  if ($nin !== undefined) {
    qb.whereNotIn(field, $nin);
  }

  return qb;
}

function generatePermissionQuery(
  permissionSchema: PermissionSchema,
  schema: DbSchemaModel
) {
  const rootQuery = getRootQueryWithJoins(permissionSchema, schema);

  const { operation, table, config } = permissionSchema;
  const { $or, $and, ...fields } = config;

  const query = rootQuery.where((qb) => {
    if ($or) {
      $or.forEach((orConfig) => {
        qb.orWhere(
          generatePermissionQuery(
            { operation, table, config: orConfig },
            schema
          )
        );
      });
    }
    if ($and) {
      $and.forEach((andConfig) => {
        qb.andWhere(
          generatePermissionQuery(
            { operation, table, config: andConfig },
            schema
          )
        );
      });
    }

    Object.keys(fields).forEach((field) => {
      const fieldConfig = fields[field];

      if (!fieldConfig) return;

      if (getIsValueConfig(fieldConfig)) {
        const attribute = schema.getAttribute(table, field);

        if (!attribute) {
          throw new Error(
            `Attribute ${field} of table ${table} not found in schema`
          );
        }

        applyFieldValueWhere(field, fieldConfig, qb);
      }

      if (getIsRelationConfig(fieldConfig)) {
        const relation = schema.getRelation(table, field);

        if (!relation || relation.type !== "collection") {
          throw new Error(
            `Relation ${field} of table ${table} not found in schema`
          );
        }

        const { some, every, none } = fieldConfig;
      }

      // field is reference FK to other table conditions
      const relation = schema.getRelation(table, field);

      if (!relation || relation.type !== "reference") {
        throw new Error(
          `Relation ${field} of table ${table} not found in schema`
        );
      }
    });
  });

  return query;
}

export function parsePermission() {}

const schema = {
  entities: [
    {
      name: "list",
      idField: "id",
      attributes: [
        { name: "id", type: "uuid", isNullable: false },
        { name: "is_private", type: "bool", isNullable: false },
        { name: "name", type: "text", isNullable: false },
      ],
      relations: [
        {
          type: "collection",
          name: "todos",
          referencedByEntity: "todo",
          referencedByField: "list_id",
        },
      ],
    },
    {
      name: "todo",
      idField: "id",
      attributes: [
        { name: "done_at", type: "timestamp", isNullable: true },
        { name: "id", type: "uuid", isNullable: false },
        { name: "list_id", type: "uuid", isNullable: false },
        { name: "name", type: "text", isNullable: false },
      ],
      relations: [
        {
          type: "reference",
          isNullable: false,
          name: "list",
          referencedEntity: "list",
          referenceField: "list_id",
        },
      ],
    },
  ],
};

const permissions = {
  todo: {
    list: {
      is_private: false,
    },
  },
};

const db = knex();

async function getAccessableTodos(table: "todo") {
  const accessableTodos = await db
    .with("accessable_list", (q) => {
      q.select("*").from("list").where("is_private", false);
    })
    .select("*")
    .from("todo")
    .innerJoin("accessable_list", "list_id", "id");

  return accessableTodos;
}

const db = knex();

const CurrentUser = "<CURRENT_USER>";

const permissions2 = {
  todo: {
    list: {
      $or: [
        { is_private: false },
        {
          members: {
            some: {
              user_id: CurrentUser,
            },
          },
        },
      ],
    },
  },
};

async function getAccessableTodos2(table: "todo", userId: string) {
  db;
  return function generateQueryCheck() {
    return db
      .select("*")
      .from("todo")
      .join("list", "todo.list_id", "list.id")
      .where((qb) => {
        return qb
          .orWhere((qb) => {
            qb.where("list.is_private", "=", false);
          })
          .orWhere((qb) => {
            const memberExists = db
              .select("id")
              .from("member")
              .where("member.list_id", "list.id")
              .andWhere("member.user_id", userId);
            return qb.whereExists(memberExists);
          });
      });
  };
}
