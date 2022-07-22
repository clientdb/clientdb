import { DbSchema } from "../schema/schema";
import {
  SchemaCollection,
  SchemaReference,
  SchemaPermissions,
  currentUser,
  SchemaWhere,
} from "../schema/types";

interface User {
  id: string;
  name: string;
  password: string;
  todos: SchemaCollection<Todo>;
  lists: SchemaCollection<List>;
}

interface List {
  id: string;
  is_private: boolean;
  name: string;
  user_id: string;
  todos: SchemaCollection<Todo>;
  user: SchemaReference<User>;
}

interface Todo {
  done_at: string | null;
  id: string;
  list_id: string;
  name: string;
  user_id: string;
  list: SchemaReference<List>;
  user: SchemaReference<User>;
}

export interface TestSchema {
  todo: Todo;
  list: List;
  user: User;
}

type Permissions = SchemaPermissions<TestSchema>;
type Where = SchemaWhere<TestSchema>;

export const schema: DbSchema = {
  entities: [
    {
      name: "user",
      idField: "id",
      attributes: [
        { name: "id", type: "uuid", isNullable: false },
        { name: "name", type: "text", isNullable: false },
        { name: "password", type: "text", isNullable: false },
      ],
      relations: [
        {
          type: "collection",
          name: "todos",
          referencedByEntity: "todo",
          referencedByField: "user_id",
        },
        {
          type: "collection",
          name: "lists",
          referencedByEntity: "list",
          referencedByField: "user_id",
        },
      ],
    },
    {
      name: "list",
      idField: "id",
      attributes: [
        { name: "id", type: "uuid", isNullable: false },
        { name: "is_private", type: "bool", isNullable: false },
        { name: "name", type: "text", isNullable: false },
        { name: "user_id", type: "uuid", isNullable: false },
      ],
      relations: [
        {
          type: "collection",
          name: "todos",
          referencedByEntity: "todo",
          referencedByField: "list_id",
        },
        {
          type: "reference",
          isNullable: false,
          name: "user",
          referencedEntity: "user",
          referenceField: "user_id",
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
        { name: "user_id", type: "uuid", isNullable: false },
      ],
      relations: [
        {
          type: "reference",
          isNullable: false,
          name: "list",
          referencedEntity: "list",
          referenceField: "list_id",
        },
        {
          type: "reference",
          isNullable: false,
          name: "user",
          referencedEntity: "user",
          referenceField: "user_id",
        },
      ],
    },
  ],
};

const selfUser: Where["user"] = {
  id: currentUser,
};

const ownedList: Where["list"] = {
  user_id: currentUser,
};

const publicList: Where["list"] = {
  is_private: false,
};

const publicTodo: Where["todo"] = {
  list: publicList,
};

const ownedTodo: Where["todo"] = {
  user_id: currentUser,
};

export const permissions: Permissions = {
  user: {
    read: {
      rule: selfUser,
      fields: ["id", "name"],
    },
    update: {
      rule: selfUser,
      fields: ["name"],
    },
    remove: selfUser,
    create: {
      rule: {},
    },
  },
  list: {
    read: {
      rule: {
        $or: [ownedList, publicList],
      },
    },
    create: {
      rule: ownedList,
      fields: ["id", "is_private", "name"],
      preset: {
        user_id: currentUser,
      },
    },
    remove: ownedList,
    update: {
      rule: ownedList,
      fields: ["is_private", "name"],
    },
  },
  todo: {
    read: {
      rule: {
        $or: [ownedTodo, publicTodo],
      },
      fields: ["done_at", "id", "name"],
    },
    create: {
      rule: ownedTodo,
      preset: {
        user_id: currentUser,
      },
    },
    remove: ownedTodo,
    update: {
      rule: ownedTodo,
      fields: ["name", "done_at", "list_id"],
    },
  },
};
