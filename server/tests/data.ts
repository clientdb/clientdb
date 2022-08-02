import { SyncServer } from "@clientdb/server/server";
import { TestSchema } from "./schema";
import { v4 } from "uuid";
import { createDeterministicUUID } from "./utils/uuid";

export async function createRandomTeamWithoutSync(
  server: SyncServer<TestSchema>
) {
  const uuid = createDeterministicUUID();

  const ids = {
    user: {
      owner: uuid(),
      member: uuid(),
      out: uuid(),
    },
    team: {
      a: uuid(),
    },
    list: {
      a: uuid(),
    },
    label: {
      public: uuid(),
      private: uuid(),
    },
    todo: {
      a: uuid(),
    },
  };

  const db = server.db;

  await Promise.all([
    db.table("user").insert([
      {
        id: ids.user.owner,
        name: "owner",
        password: "aaa",
      },
      {
        id: ids.user.member,
        name: "member",
        password: "aaa",
      },
      {
        id: ids.user.out,
        name: "outsider",
        password: "aaa",
      },
    ]),
  ]);

  await db.table("team").insert({
    id: ids.team.a,
    name: "team-1",
    owner_id: ids.user.owner,
  });

  await Promise.all([
    db.table("teamMembership").insert([
      {
        id: uuid(),
        team_id: ids.team.a,
        user_id: ids.user.owner,
        is_disabled: false,
      },
      {
        id: uuid(),
        team_id: ids.team.a,
        user_id: ids.user.member,
        is_disabled: false,
      },
    ]),

    db.table("list").insert({
      id: ids.list.a,
      name: "list-1",
      team_id: ids.team.a,
      user_id: ids.user.owner,
    }),

    db.table("label").insert([
      {
        id: ids.label.public,
        name: "label-public",
        user_id: ids.user.owner,
        team_id: ids.team.a,
        is_public: true,
      },
      {
        id: ids.label.private,
        name: "label-private",
        user_id: ids.user.owner,
        team_id: ids.team.a,
        is_public: false,
      },
    ]),
  ]);

  await db.table("todo").insert({
    id: ids.todo.a,
    name: "todo-1",
    list_id: ids.list.a,
    user_id: ids.user.owner,
    done_at: null,
  });

  const todoInputs = Array.from({ length: 20 }).map(() => {
    return {
      id: uuid(),
      name: "todo-1",
      list_id: ids.list.a,
      user_id: ids.user.owner,
      done_at: null,
    };
  });

  await db.table("todo").insert(todoInputs);

  await Promise.all([
    db.table("todoLabel").insert([
      {
        id: uuid(),
        todo_id: ids.todo.a,
        label_id: ids.label.public,
      },
      {
        id: uuid(),
        todo_id: ids.todo.a,
        label_id: ids.label.private,
      },
    ]),
  ]);

  return ids;
}

async function createRandomTeams(server: SyncServer<TestSchema>, n: number) {
  const promises = Array.from({ length: n }).map(() => {
    return createRandomTeamWithoutSync(server);
  });

  await Promise.all(promises);
}

export async function createTestData(server: SyncServer<TestSchema>) {
  const uuid = createDeterministicUUID(1);
  //
  // await createRandomTeams(server, 500);

  const {
    admin: { create },
  } = server;

  const ids = {
    user: {
      owner: uuid(),
      member: uuid(),
      out: uuid(),
    },
    team: {
      a: uuid(),
    },
    list: {
      a: uuid(),
    },
    label: {
      public: uuid(),
      private: uuid(),
    },
    todo: {
      a: uuid(),
    },
  };

  await create("user", {
    id: ids.user.owner,
    name: "owner",
    password: "aaa",
  });

  await create("user", {
    id: ids.user.member,
    name: "member",
    password: "aaa",
  });

  await create("user", {
    id: ids.user.out,
    name: "outsider",
    password: "aaa",
  });

  await create(
    "team",
    {
      id: ids.team.a,
      name: "team-1",
      owner_id: ids.user.owner,
    },
    { userId: ids.user.owner }
  );

  await create(
    "teamMembership",
    {
      id: uuid(),
      team_id: ids.team.a,
      user_id: ids.user.owner,
      is_disabled: false,
    },
    { userId: ids.user.owner }
  );

  await create(
    "teamMembership",
    {
      id: uuid(),
      team_id: ids.team.a,
      user_id: ids.user.member,
      is_disabled: false,
    },
    { userId: ids.user.owner }
  );

  await create(
    "list",
    {
      id: ids.list.a,
      name: "list-1",
      team_id: ids.team.a,
      user_id: ids.user.owner,
    },
    { userId: ids.user.owner }
  );

  await create(
    "label",
    {
      id: ids.label.public,
      name: "label-public",
      user_id: ids.user.owner,
      team_id: ids.team.a,
      is_public: true,
    },
    { userId: ids.user.owner }
  );

  await create(
    "label",
    {
      id: ids.label.private,
      name: "label-private",
      user_id: ids.user.owner,
      team_id: ids.team.a,
      is_public: false,
    },
    { userId: ids.user.owner }
  );

  await create(
    "todo",
    {
      id: ids.todo.a,
      name: "todo-1",
      list_id: ids.list.a,
      user_id: ids.user.owner,
      done_at: null,
    },
    { userId: ids.user.owner }
  );

  await create(
    "todoLabel",
    {
      id: uuid(),
      todo_id: ids.todo.a,
      label_id: ids.label.public,
    },
    { userId: ids.user.owner }
  );

  await create(
    "todoLabel",
    {
      id: uuid(),
      todo_id: ids.todo.a,
      label_id: ids.label.private,
    },
    { userId: ids.user.owner }
  );

  return ids;
}
