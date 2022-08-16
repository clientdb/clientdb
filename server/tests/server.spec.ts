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

describe("server", () => {
  it("will not allow modifying data for not allowed users", async () => {
    const { server, ids } = await getTestServerWithData();
  });
  it("will not allow modifying data for not allowed users", async () => {
    const { server, ids } = await getTestServerWithData();

    await expect(
      server.admin.update(
        "team",
        ids.team.a,
        { name: "new name" },

        { userId: ids.user.out }
      )
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Not allowed to access team"`
    );

    const afterRejected = await server.admin.getInit({
      userId: ids.user.owner,
    });

    expect(parseBootLoad(afterRejected).teams[0].name).toBe("team-1");

    await expect(
      server.admin.update(
        "team",
        ids.team.a,
        { name: "new name" },
        { userId: ids.user.owner }
      )
    ).resolves.toMatchInlineSnapshot(`undefined`);

    const init = await server.admin.getInit({ userId: ids.user.owner });

    expect(parseBootLoad(init).teams[0].name).toBe("new name");

    await expect(
      server.admin.remove("team", ids.team.a, { userId: ids.user.out })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Not allowed to remove team"`
    );

    await expect(
      server.admin.remove("team", ids.team.a, { userId: ids.user.owner })
    ).resolves.toMatchInlineSnapshot(`undefined`);
  });

  it.only("will not generate proper delta for changing team owner", async () => {
    const { server, ids } = await getTestServerWithData();

    // await server.admin.update(
    //   "team",
    //   ids.team.a,
    //   { owner_id: ids.user.out },
    //   { userId: ids.user.owner }
    // );

    // await server.admin.update(
    //   "team",
    //   ids.team.a,
    //   { owner_id: ids.user.owner },
    //   { userId: ids.user.out }
    // );
  });
});
