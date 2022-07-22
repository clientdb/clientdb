import { DbSchema } from "../schema/schema";
import { createTestServer } from "./server";

import { v4 as uuidv4 } from "uuid";
import { InitialLoadData } from "../server/init";

function parseBootLoad(load: InitialLoadData) {
  const users = load.data.find((item) => item.kind === "user")?.items;
  const todos = load.data.find((item) => item.kind === "todo")?.items;
  const lists = load.data.find((item) => item.kind === "list")?.items;

  return { users, todos, lists };
}

describe("server", () => {
  it("returns proper initial load basing on permissions", async () => {
    const server = await createTestServer();

    expect("foo").toBe("foo");

    const userId = uuidv4();
    const userBId = uuidv4();

    await server.admin.create("user", { id: userId, name: "user-1" });
    await server.admin.create("user", { id: userBId, name: "user-2" });

    const listId = uuidv4();

    await server.admin.create("list", {
      id: listId,
      name: "test",
      is_private: true,
      user_id: userId,
    });

    await server.admin.create("todo", {
      id: uuidv4(),
      list_id: listId,
      user_id: userId,
      name: "test",
    });

    const initForUserA = await server.admin.getInit({ userId });
    const initForUserB = await server.admin.getInit({ userId: userBId });

    const aData = parseBootLoad(initForUserA);
    const bData = parseBootLoad(initForUserB);

    expect(aData.users).toHaveLength(1);
    expect(aData.todos).toHaveLength(1);
    expect(aData.lists).toHaveLength(1);

    expect(bData.users).toHaveLength(1);
    expect(bData.todos).toHaveLength(0);
    expect(bData.lists).toHaveLength(0);
  });
});
