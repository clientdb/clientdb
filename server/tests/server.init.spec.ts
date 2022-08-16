import { createTestServer } from "./server";

import { createTestData } from "./data";
import { InitialLoadData } from "@clientdb/server/api/init";

jest.setTimeout(30000);

function parseBootLoad(load: InitialLoadData) {
  const users = load.data.find((item) => item.kind === "user")!.items;
  const teams = load.data.find((item) => item.kind === "team")!.items;
  const teamMemberships = load.data.find(
    (item) => item.kind === "teamMembership"
  )!.items;
  const lists = load.data.find((item) => item.kind === "list")!.items;
  const labels = load.data.find((item) => item.kind === "label")!.items;
  const todos = load.data.find((item) => item.kind === "todo")!.items;
  const todoLabels = load.data.find((item) => item.kind === "todoLabel")!.items;
  return { users, teams, teamMemberships, lists, labels, todos, todoLabels };
}

async function getTestServerWithData() {
  const server = await createTestServer();

  const ids = await createTestData(server);

  return { server, ids };
}

describe("server init", () => {
  it("returns proper initial load for owner", async () => {
    const { server, ids } = await getTestServerWithData();

    const owner = parseBootLoad(
      await server.admin.getInit({ userId: ids.user.owner })
    );

    expect(owner.labels).toHaveLength(2);
    expect(owner.lists).toHaveLength(1);
    expect(owner.users).toHaveLength(2);
    expect(owner.todos).toHaveLength(1);
  });
  it("returns proper initial load for member", async () => {
    const { server, ids } = await getTestServerWithData();

    const member = parseBootLoad(
      await server.admin.getInit({ userId: ids.user.member })
    );

    expect(member.labels).toHaveLength(1);
    expect(member.lists).toHaveLength(1);
    expect(member.users).toHaveLength(2);
    expect(member.todos).toHaveLength(1);
  });
  it("returns proper initial load for outsider", async () => {
    const { server, ids } = await getTestServerWithData();

    const outsider = parseBootLoad(
      await server.admin.getInit({ userId: ids.user.out })
    );

    expect(outsider.labels).toHaveLength(0);
    expect(outsider.lists).toHaveLength(0);
    expect(outsider.users).toHaveLength(1);
    expect(outsider.todos).toHaveLength(0);
  });
});
