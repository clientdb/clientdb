import {
  createEntityFromSchema,
  EntityByDefinition,
  Collection,
} from "clientdb";

export interface ListData {
  __kind: "list";
  id: string;
  is_private: boolean;
  name: string;
}

export interface ListRelations {
  todos: Collection<TodoEntity>;
}

export interface TodoData {
  __kind: "todo";
  done_at: Date;
  id: string;
  list_id: string;
  name: string;
}

export interface TodoRelations {
  list: ListEntity;
}

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

export const listEntity = createEntityFromSchema<ListData, ListRelations>(
  schema,
  "list"
);

export type ListEntity = EntityByDefinition<typeof listEntity>;

export const todoEntity = createEntityFromSchema<TodoData, TodoRelations>(
  schema,
  "todo"
);

export type TodoEntity = EntityByDefinition<typeof todoEntity>;

const coolnesView = listEntity.createView((data) => {
  return {
    get isCool() {
      return data.power > 4000;
    },
  };
});

// and then
db.entity(listEntity).first.view(coolnesView).isCool;

declare module "clientdb/generated" {
  interface TodoView extends ViewByDefinition<typeof superListEntity> {}
}

/////////////////////////////////////////

db.entity(superListEntity).first.isCool;

db.entity(todo).first.list.isCool;
