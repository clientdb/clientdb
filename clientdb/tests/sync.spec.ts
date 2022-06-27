import { waitForAllSyncToFlush } from "clientdb";
import { createResolvablePromise, wait } from "../entity/utils/promises";

import { DefaultEntitiesMap, TestOwnerEntity, createTestDb } from "./utils";

describe("sync", () => {
  it("will have data from first sync on initial result", async () => {
    const db = await createTestDb<DefaultEntitiesMap>({
      syncMocks: {
        owner: {
          pullUpdated: ({ isFirstSync, updateItems }) => {
            if (isFirstSync) {
              updateItems([{ id: "1", name: "Adam", updatedAt: new Date() }]);
            }
          },
        },
      },
    });

    const owners = db.owner.all;

    expect(owners).toHaveLength(1);
    expect(owners[0].name).toBe("Adam");
    db.destroy();
  });

  it("will not render until initial sync is ready", async () => {
    const firstSyncPromise = createResolvablePromise<void>();
    const dbPromise = createTestDb<DefaultEntitiesMap>({
      syncMocks: {
        owner: {
          pullUpdated: ({ updateItems }) => {
            async function waitAndUpdate() {
              await firstSyncPromise.promise;

              updateItems([]);
            }

            waitAndUpdate();
          },
        },
      },
    });

    const dbReadyCallback = jest.fn();

    dbPromise.then(() => dbReadyCallback());

    expect(dbReadyCallback).not.toBeCalled();

    await wait(200);

    expect(dbReadyCallback).not.toBeCalled();

    firstSyncPromise.resolve();

    const db = await dbPromise;

    expect(dbReadyCallback).toBeCalled();

    db.destroy();
  });

  it("will send updates to sync", async () => {
    const push = jest.fn(async (entity: TestOwnerEntity) => {
      return entity;
    });
    const db = await createTestDb<DefaultEntitiesMap>({
      syncMocks: {
        owner: {
          push,
        },
      },
    });

    db.owner.create({ name: "Adam" });

    await waitForAllSyncToFlush();
    expect(push).toBeCalledTimes(1);
    db.destroy();
  });

  it("will restore removed entity if remove sync fails", async () => {
    const pushWait = createResolvablePromise();
    const remove = jest.fn(async () => {
      await pushWait.promise;
      return false;
    });
    const db = await createTestDb<DefaultEntitiesMap>({
      syncMocks: {
        owner: {
          remove,
        },
      },
    });

    const owner = db.owner.create({ name: "Adam" });

    expect(db.owner.all).toHaveLength(1);

    await owner.waitForSync();

    owner.remove();

    expect(db.owner.all).toHaveLength(0);

    pushWait.resolve();

    await waitForAllSyncToFlush();

    expect(db.owner.all).toHaveLength(1);

    db.destroy();
  });

  it("will update item data with server version during push", async () => {
    const push = jest.fn(async (entity: TestOwnerEntity) => {
      return { ...entity, name: "From Server" };
    });
    const db = await createTestDb<DefaultEntitiesMap>({
      syncMocks: {
        owner: {
          push,
        },
      },
    });

    const owner = db.owner.create({ name: "Adam" });

    await waitForAllSyncToFlush();
    expect(owner.name).toBe("From Server");
    db.destroy();
  });

  it("will update item data with server version during push", async () => {
    const push = jest.fn(async (entity: TestOwnerEntity) => {
      return { ...entity, name: "From Server" };
    });
    const db = await createTestDb<DefaultEntitiesMap>({
      syncMocks: {
        owner: {
          push,
        },
      },
    });

    const owner = db.owner.create({ name: "Adam" });

    await waitForAllSyncToFlush();
    expect(owner.name).toBe("From Server");
    db.destroy();
  });
});
