import { Knex, knex } from "knex";

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
