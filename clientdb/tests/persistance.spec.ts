import { PERSISTANCE_BATCH_FLUSH_TIMEOUT } from "clientdb/persistance";
import { wait } from "../utils/promises";

import { createTestDb, owner } from "./utils";

describe("persistance", () => {
  it("populates clientdb with persisted data initially", async () => {
    const db = await createTestDb({
      persistanceMocks: {
        owner: {
          async fetchAllItems() {
            return [{ id: "1", name: "Adam", updatedAt: new Date() }];
          },
        },
      },
    });

    const owners = db.entity(owner).all;

    expect(owners).toHaveLength(1);
    expect(owners[0].name).toBe("Adam");
    db.destroy();
  });

  it("properly calls persistance on entity updates", async () => {
    const saveItems = jest.fn(async () => {
      return true;
    });

    const removeItems = jest.fn(async () => {
      return true;
    });

    const db = await createTestDb({
      persistanceMocks: {
        owner: {
          saveItems,
          removeItems,
        },
      },
    });

    const ownerEnt = db.entity(owner).create({ name: "Adam" });

    await wait(PERSISTANCE_BATCH_FLUSH_TIMEOUT + 10);

    expect(saveItems).toBeCalledTimes(1);

    ownerEnt.update({ name: "Omar" });

    await wait(PERSISTANCE_BATCH_FLUSH_TIMEOUT + 10);

    expect(saveItems).toBeCalledTimes(2);

    ownerEnt.remove();

    await wait(PERSISTANCE_BATCH_FLUSH_TIMEOUT + 10);

    expect(removeItems).toBeCalledTimes(1);
    expect(saveItems).toBeCalledTimes(2);

    db.destroy();
  });
});
