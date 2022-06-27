import { PERSISTANCE_BATCH_FLUSH_TIMEOUT } from "clientdb/entity/persistance";
import { wait } from "../entity/utils/promises";


import { DefaultEntitiesMap, createTestDb } from "./utils";

describe("persistance", () => {
  it("populates clientdb with persisted data initially", async () => {
    const db = await createTestDb<DefaultEntitiesMap>({
      persistanceMocks: {
        owner: {
          async fetchAllItems() {
            return [{ id: "1", name: "Adam", updatedAt: new Date() }];
          },
        },
      },
    });

    const owners = db.owner.all;

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

    const db = await createTestDb<DefaultEntitiesMap>({
      persistanceMocks: {
        owner: {
          saveItems,
          removeItems,
        },
      },
    });

    const owner = db.owner.create({ name: "Adam" });

    await wait(PERSISTANCE_BATCH_FLUSH_TIMEOUT + 10);

    expect(saveItems).toBeCalledTimes(1);

    owner.update({ name: "Omar" });

    await wait(PERSISTANCE_BATCH_FLUSH_TIMEOUT + 10);

    expect(saveItems).toBeCalledTimes(2);

    owner.remove();

    await wait(PERSISTANCE_BATCH_FLUSH_TIMEOUT + 10);

    expect(removeItems).toBeCalledTimes(1);
    expect(saveItems).toBeCalledTimes(2);

    db.destroy();
  });
});
