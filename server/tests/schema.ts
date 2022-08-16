import {
  EntitiesSchemaInput,
  SchemaCollection,
  SchemaEntityInput,
  SchemaReference,
  EntitiesSchema,
} from "@clientdb/schema";
import {
  currentUser,
  SchemaPermissions,
  SchemaRules,
} from "@clientdb/server/permissions/input";
import knex from "knex";
import { PermissionsRoot } from "../permissions/PermissionsRoot";
import { testDb } from "./server";

type Permissions = SchemaPermissions<TestSchema>;
type Rule = SchemaRules<TestSchema>;

interface User {
  id: string;
  name: string;
  password: string;
  todos: SchemaCollection<Todo>;
  lists: SchemaCollection<List>;
  teamMemberships: SchemaCollection<TeamMembership>;
  labels: SchemaCollection<Label>;
}

const userSchema: SchemaEntityInput = {
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
      field: "user_id",
      target: "todo",
    },
    {
      type: "collection",
      name: "lists",
      field: "user_id",
      target: "list",
    },
    {
      type: "collection",
      name: "teamMemberships",
      field: "user_id",
      target: "teamMembership",
    },
    {
      type: "collection",
      name: "labels",
      field: "user_id",
      target: "label",
    },
  ],
};

const selfUser: Rule["user"] = {
  id: currentUser,
};

const userPermissions: Permissions["user"] = {
  create: {
    rule: {},
  },
  read: {
    fields: ["id", "name"],
    rule: {
      $or: [
        selfUser,
        {
          teamMemberships: {
            team: {
              $or: [
                {
                  owner_id: currentUser,
                },
                {
                  teamMemberships: {
                    user_id: currentUser,
                    is_disabled: false,
                  },
                },
              ],
            },
          },
        },
      ],
    },
  },
  update: {
    rule: selfUser,
  },
  remove: selfUser,
};

interface Team {
  id: string;
  name: string;
  owner_id: string;
  owner: SchemaReference<User>;
  teamMemberships: SchemaCollection<TeamMembership>;
  labels: SchemaCollection<Label>;
  lists: SchemaCollection<List>;
}

const teamSchema: SchemaEntityInput = {
  name: "team",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "text", isNullable: false },
    { name: "owner_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      type: "reference",
      name: "owner",
      field: "owner_id",
      target: "user",
      isNullable: false,
    },
    {
      type: "collection",
      name: "teamMemberships",
      field: "team_id",
      target: "teamMembership",
    },
    {
      type: "collection",
      name: "labels",
      field: "team_id",
      target: "label",
    },
    {
      type: "collection",
      name: "lists",
      field: "team_id",
      target: "list",
    },
  ],
};

const teamOwner: Rule["team"] = {
  owner_id: currentUser,
};

const teamMemberOrOwner: Rule["team"] = {
  $or: [
    teamOwner,
    {
      teamMemberships: {
        is_disabled: false,
        user_id: currentUser,
      },
    },
  ],
};

const teamPermissions: Permissions["team"] = {
  read: {
    rule: teamMemberOrOwner,
  },
  create: {
    rule: teamOwner,
    preset: {
      owner_id: currentUser,
    },
  },
  update: {
    rule: teamOwner,
  },
  remove: teamOwner,
};

interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  is_disabled: boolean;
  user: SchemaReference<User>;
  team: SchemaReference<Team>;
}

const teamMembershipSchema: SchemaEntityInput = {
  name: "teamMembership",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "team_id", type: "uuid", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
    { name: "is_disabled", type: "boolean", isNullable: false },
  ],
  relations: [
    {
      type: "reference",
      name: "user",
      field: "user_id",
      target: "user",
      isNullable: false,
    },
    {
      type: "reference",
      name: "team",
      field: "team_id",
      target: "team",
      isNullable: false,
    },
  ],
};

const teamMembershipPermissions: Permissions["teamMembership"] = {
  read: {
    rule: {
      team: teamMemberOrOwner,
    },
  },
  create: {
    rule: {
      team: teamOwner,
    },
    preset: {},
  },
  update: {
    rule: {
      team: teamOwner,
    },
  },
  remove: {
    team: teamOwner,
  },
};

interface List {
  id: string;
  name: string;
  user_id: string;
  team_id: string;
  todos: SchemaCollection<Todo>;
  team: SchemaReference<Team>;
  user: SchemaReference<User>;
}

const listSchema: SchemaEntityInput = {
  name: "list",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "text", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
    { name: "team_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      type: "collection",
      name: "todos",
      field: "list_id",
      target: "todo",
    },
    {
      type: "reference",
      name: "team",
      field: "team_id",
      target: "team",
      isNullable: false,
    },
    {
      type: "reference",
      name: "user",
      field: "user_id",
      target: "user",
      isNullable: false,
    },
  ],
};

const listOrTeamOwner: Rule["list"] = {
  $or: [{ user_id: currentUser }, { team: teamOwner }],
};

const listPermissions: Permissions["list"] = {
  read: {
    rule: {
      team: teamMemberOrOwner,
    },
  },
  create: {
    rule: {
      team: teamMemberOrOwner,
    },
    preset: {
      user_id: currentUser,
    },
  },
  update: {
    rule: listOrTeamOwner,
  },
  remove: listOrTeamOwner,
};

interface Label {
  id: string;
  name: string;
  user_id: string;
  team_id: string;
  is_public: boolean;
  team: SchemaReference<Team>;
  todoLabels: SchemaCollection<TodoLabel>;
  user: SchemaReference<User>;
}

const labelSchema: SchemaEntityInput = {
  name: "label",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "text", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
    { name: "team_id", type: "uuid", isNullable: false },
    { name: "is_public", type: "boolean", isNullable: false },
  ],
  relations: [
    {
      type: "collection",
      name: "todoLabels",
      field: "label_id",
      target: "todoLabel",
    },
    {
      type: "reference",
      name: "team",
      field: "team_id",
      target: "team",
      isNullable: false,
    },
    {
      type: "reference",
      name: "user",
      field: "user_id",
      target: "user",
      isNullable: false,
    },
  ],
};

const canSeeLabel: Rule["label"] = {
  $or: [
    {
      is_public: true,
      team: teamMemberOrOwner,
    },
    { user_id: currentUser },
  ],
};

const labelPermissions: Permissions["label"] = {
  read: {
    rule: canSeeLabel,
  },
  create: {
    rule: {
      user_id: currentUser,
      team: teamMemberOrOwner,
    },
    preset: {
      user_id: currentUser,
    },
  },
  update: {
    rule: {
      user_id: currentUser,
    },
  },
  remove: { user_id: currentUser },
};

interface TodoLabel {
  id: string;
  label_id: string;
  todo_id: string;
  label: SchemaReference<Label>;
  todo: SchemaReference<Todo>;
}

const todoLabelSchema: SchemaEntityInput = {
  name: "todoLabel",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "label_id", type: "uuid", isNullable: false },
    { name: "todo_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      type: "reference",
      name: "label",
      field: "label_id",
      target: "label",
      isNullable: false,
    },
    {
      type: "reference",
      name: "todo",
      field: "todo_id",
      target: "todo",
      isNullable: false,
    },
  ],
};

const todoLabelPermissions: Permissions["todoLabel"] = {
  read: {
    rule: {
      label: canSeeLabel,
    },
  },
  create: {
    rule: {
      label: canSeeLabel,
    },
    preset: {},
  },
  update: {
    rule: {
      label: canSeeLabel,
    },
  },
  remove: {
    label: canSeeLabel,
  },
};

interface Todo {
  id: string;
  name: string;
  done_at: string | null;
  list_id: string;
  user_id: string;
  list: SchemaReference<List>;
  user: SchemaReference<User>;
  todoLabels: SchemaCollection<TodoLabel>;
}

const todoSchema: SchemaEntityInput = {
  name: "todo",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "text", isNullable: false },
    { name: "done_at", type: "text", isNullable: true },
    { name: "list_id", type: "uuid", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      type: "reference",
      name: "list",
      field: "list_id",
      target: "list",
      isNullable: false,
    },
    {
      type: "reference",
      name: "user",
      field: "user_id",
      target: "user",
      isNullable: false,
    },
    {
      type: "collection",
      name: "todoLabels",
      field: "todo_id",
      target: "todoLabel",
    },
  ],
};

const todoPermissions: Permissions["todo"] = {
  read: {
    rule: {
      list: {
        team: teamMemberOrOwner,
      },
    },
  },
  create: {
    rule: {
      user_id: currentUser,
      list: {
        team: teamMemberOrOwner,
      },
    },
    preset: {
      user_id: currentUser,
    },
  },
  update: {
    rule: {
      list: {
        team: teamMemberOrOwner,
      },
    },
  },
  remove: {
    list: {
      team: teamMemberOrOwner,
    },
  },
};

export interface TestSchema {
  user: User;
  team: Team;
  teamMembership: TeamMembership;
  list: List;
  label: Label;
  todoLabel: TodoLabel;
  todo: Todo;
}

export const schema: EntitiesSchemaInput = {
  entities: [
    userSchema,
    teamSchema,
    teamMembershipSchema,
    listSchema,
    labelSchema,
    todoLabelSchema,
    todoSchema,
  ],
};

export const schemaModel = new EntitiesSchema(schema, {
  db: testDb,
  userTable: "user",
});

export const permissions: Permissions = {
  user: userPermissions,
  team: teamPermissions,
  teamMembership: teamMembershipPermissions,
  list: listPermissions,
  label: labelPermissions,
  todoLabel: todoLabelPermissions,
  todo: todoPermissions,
};

export const permissionsModel = new PermissionsRoot(permissions, schemaModel);
