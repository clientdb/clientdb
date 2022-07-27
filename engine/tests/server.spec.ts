import { createTestServer } from "./server";

import { InitialLoadData } from "../server/init";
import { createTestData } from "./data";

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

describe("server", () => {
  it("returns proper initial load basing on permissions", async () => {
    const { server, ids } = await getTestServerWithData();

    const owner = parseBootLoad(
      await server.admin.getInit({ userId: ids.user.owner })
    );
    const member = parseBootLoad(
      await server.admin.getInit({ userId: ids.user.member })
    );
    const outsider = parseBootLoad(
      await server.admin.getInit({ userId: ids.user.out })
    );

    expect(owner.labels).toHaveLength(2);
    expect(member.labels).toHaveLength(1);
    expect(outsider.labels).toHaveLength(0);

    expect(owner.lists).toHaveLength(1);
    expect(member.lists).toHaveLength(1);
    expect(outsider.lists).toHaveLength(0);

    expect(owner.users).toHaveLength(2);
    expect(member.users).toHaveLength(2);
    expect(outsider.users).toHaveLength(1);

    expect(owner.todos).toHaveLength(1);
    expect(member.todos).toHaveLength(1);
    expect(outsider.todos).toHaveLength(0);
  });

  it("will not allow modifying data for not allowed users", async () => {
    const { server, ids } = await getTestServerWithData();

    await expect(
      server.admin.mutate(
        {
          entity: "team",
          type: "update",
          id: ids.team.a,
          data: { name: "new name" },
        },

        { userId: ids.user.out }
      )
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"Not allowed to update"`);

    const afterRejected = await server.admin.getInit({
      userId: ids.user.owner,
    });

    expect(parseBootLoad(afterRejected).teams[0].name).toBe("team-1");

    await server.admin.mutate(
      {
        entity: "team",
        type: "update",
        id: ids.team.a,
        data: { name: "new name" },
      },

      { userId: ids.user.owner }
    );

    await expect(
      server.admin.mutate(
        {
          entity: "team",
          type: "update",
          id: ids.team.a,
          data: { name: "new name" },
        },

        { userId: ids.user.owner }
      )
    ).resolves.toMatchInlineSnapshot(`undefined`);

    const init = await server.admin.getInit({ userId: ids.user.owner });

    expect(parseBootLoad(init).teams[0].name).toBe("new name");

    await expect(
      server.admin.mutate(
        {
          entity: "team",
          type: "remove",
          id: ids.team.a,
        },

        { userId: ids.user.out }
      )
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"Not allowed to delete"`);
  });
});
