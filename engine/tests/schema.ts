import { DbSchema, SchemaEntity } from "../schema/schema";
import {
  currentUser,
  SchemaCollection,
  SchemaPermissions,
  SchemaReference,
  SchemaRules,
} from "../schema/types";

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

const userSchema: SchemaEntity = {
  name: "user",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "string", isNullable: false },
    { name: "password", type: "string", isNullable: false },
  ],
  relations: [
    {
      name: "todos",
      type: "collection",
      referencedByField: "user_id",
      referencedByEntity: "todo",
    },
    {
      name: "lists",
      type: "collection",
      referencedByField: "user_id",
      referencedByEntity: "list",
    },
    {
      name: "teamMemberships",
      type: "collection",
      referencedByField: "user_id",
      referencedByEntity: "teamMembership",
    },
    {
      name: "labels",
      type: "collection",
      referencedByField: "user_id",
      referencedByEntity: "label",
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
    rule: {
      $or: [
        selfUser,
        {
          teamMemberships: {
            team: {
              teamMemberships: {
                user_id: currentUser,
              },
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

const teamSchema: SchemaEntity = {
  name: "team",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "string", isNullable: false },
    { name: "owner_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      name: "owner",
      type: "reference",
      referenceField: "owner_id",
      referencedEntity: "user",
      isNullable: false,
    },
    {
      name: "teamMemberships",
      type: "collection",
      referencedByField: "team_id",
      referencedByEntity: "teamMembership",
    },
    {
      name: "labels",
      type: "collection",
      referencedByField: "team_id",
      referencedByEntity: "label",
    },
    {
      name: "lists",
      type: "collection",
      referencedByField: "team_id",
      referencedByEntity: "list",
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
  user: SchemaReference<User>;
  team: SchemaReference<Team>;
}

const teamMembershipSchema: SchemaEntity = {
  name: "teamMembership",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "team_id", type: "uuid", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      name: "user",
      type: "reference",
      referenceField: "user_id",
      referencedEntity: "user",
      isNullable: false,
    },
    {
      name: "team",
      type: "reference",
      referenceField: "team_id",
      referencedEntity: "team",
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

const listSchema: SchemaEntity = {
  name: "list",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "string", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
    { name: "team_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      name: "todos",
      type: "collection",
      referencedByField: "list_id",
      referencedByEntity: "todo",
    },
    {
      name: "team",
      type: "reference",
      referenceField: "team_id",
      referencedEntity: "team",
      isNullable: false,
    },
    {
      name: "user",
      type: "reference",
      referenceField: "user_id",
      referencedEntity: "user",
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

const labelSchema: SchemaEntity = {
  name: "label",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "string", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
    { name: "team_id", type: "uuid", isNullable: false },
    { name: "is_public", type: "boolean", isNullable: false },
  ],
  relations: [
    {
      name: "todoLabels",
      type: "collection",
      referencedByField: "label_id",
      referencedByEntity: "todoLabel",
    },
    {
      name: "team",
      type: "reference",
      referenceField: "team_id",
      referencedEntity: "team",
      isNullable: false,
    },
    {
      name: "user",
      type: "reference",
      referenceField: "user_id",
      referencedEntity: "user",
      isNullable: false,
    },
  ],
};

const canSeeLabel: Rule["label"] = {
  $or: [{ is_public: true, team: teamMemberOrOwner }, { user_id: currentUser }],
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

const todoLabelSchema: SchemaEntity = {
  name: "todoLabel",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "label_id", type: "uuid", isNullable: false },
    { name: "todo_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      name: "label",
      type: "reference",
      referenceField: "label_id",
      referencedEntity: "label",
      isNullable: false,
    },
    {
      name: "todo",
      type: "reference",
      referenceField: "todo_id",
      referencedEntity: "todo",
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

const todoSchema: SchemaEntity = {
  name: "todo",
  idField: "id",
  attributes: [
    { name: "id", type: "uuid", isNullable: false },
    { name: "name", type: "string", isNullable: false },
    { name: "done_at", type: "string", isNullable: true },
    { name: "list_id", type: "uuid", isNullable: false },
    { name: "user_id", type: "uuid", isNullable: false },
  ],
  relations: [
    {
      name: "list",
      type: "reference",
      referenceField: "list_id",
      referencedEntity: "list",
      isNullable: false,
    },
    {
      name: "user",
      type: "reference",
      referenceField: "user_id",
      referencedEntity: "user",
      isNullable: false,
    },
    {
      name: "todoLabels",
      type: "collection",
      referencedByField: "todo_id",
      referencedByEntity: "todoLabel",
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

export const schema: DbSchema = {
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

export const permissions: Permissions = {
  user: userPermissions,
  team: teamPermissions,
  teamMembership: teamMembershipPermissions,
  list: listPermissions,
  label: labelPermissions,
  todoLabel: todoLabelPermissions,
  todo: todoPermissions,
};
