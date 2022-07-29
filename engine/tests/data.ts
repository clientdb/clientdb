import { SyncServer } from "../server";
import { TestSchema } from "./schema";
import { v4 } from "uuid";

function uuid() {
  return v4();
}

async function createRandomTeam(server: SyncServer<TestSchema>) {
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
    return createRandomTeam(server);
  });

  await Promise.all(promises);
}

export async function createTestData(server: SyncServer<TestSchema>) {
  await createRandomTeams(server, 500);

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

  await create("team", {
    id: ids.team.a,
    name: "team-1",
    owner_id: ids.user.owner,
  });

  await create("teamMembership", {
    id: uuid(),
    team_id: ids.team.a,
    user_id: ids.user.owner,
    is_disabled: false,
  });

  console.log("creating new member, owner should see");

  await create("teamMembership", {
    id: uuid(),
    team_id: ids.team.a,
    user_id: ids.user.member,
    is_disabled: false,
  });

  await create("list", {
    id: ids.list.a,
    name: "list-1",
    team_id: ids.team.a,
    user_id: ids.user.owner,
  });

  await create("label", {
    id: ids.label.public,
    name: "label-public",
    user_id: ids.user.owner,
    team_id: ids.team.a,
    is_public: true,
  });

  await create("label", {
    id: ids.label.private,
    name: "label-private",
    user_id: ids.user.owner,
    team_id: ids.team.a,
    is_public: false,
  });

  await create("todo", {
    id: ids.todo.a,
    name: "todo-1",
    list_id: ids.list.a,
    user_id: ids.user.owner,
    done_at: null,
  });

  await create("todoLabel", {
    id: uuid(),
    todo_id: ids.todo.a,
    label_id: ids.label.public,
  });

  await create("todoLabel", {
    id: uuid(),
    todo_id: ids.todo.a,
    label_id: ids.label.private,
  });

  return ids;
}
