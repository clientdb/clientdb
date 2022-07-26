import { SyncServer } from "../server";
import { TestSchema } from "./schema";
import { v4 } from "uuid";

function uuid() {
  return v4();
}

export async function createTestData(server: SyncServer<TestSchema>) {
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
  });

  await create("teamMembership", {
    id: uuid(),
    team_id: ids.team.a,
    user_id: ids.user.member,
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
