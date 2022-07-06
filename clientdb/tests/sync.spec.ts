import { waitForAllSyncToFlush } from "clientdb";
import { createResolvablePromise, wait } from "../utils/promises";

import {
  createTestDb,
  EntitySyncConfigMock,
  owner,
  TestOwnerEntity,
} from "./utils";

describe("sync", () => {
  it("will have data from first sync on initial result", async () => {
    const db = await createTestDb({
      syncMocks: {
        owner: {
          pullUpdated: ({ isFirstSync, updateItems }) => {
            if (isFirstSync) {
              updateItems([
                { id: "1", name: "Adam", updatedAt: new Date(), hide: false },
              ]);
            }
          },
        } as EntitySyncConfigMock<TestOwnerEntity>,
      },
    });

    const owners = db.entity(owner).all;

    expect(owners).toHaveLength(1);
    expect(owners[0].name).toBe("Adam");
    db.destroy();
  });

  it("will not render until initial sync is ready", async () => {
    const firstSyncPromise = createResolvablePromise<void>();
    const dbPromise = createTestDb({
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
    const db = await createTestDb({
      syncMocks: {
        owner: {
          push,
        },
      },
    });

    db.entity(owner).create({ name: "Adam" });

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
    const db = await createTestDb({
      syncMocks: {
        owner: {
          remove,
        },
      },
    });

    const ownerEnt = db.entity(owner).create({ name: "Adam" });

    expect(db.entity(owner).all).toHaveLength(1);

    await ownerEnt.waitForSync();

    ownerEnt.remove();

    expect(db.entity(owner).all).toHaveLength(0);

    pushWait.resolve();

    await waitForAllSyncToFlush();

    expect(db.entity(owner).all).toHaveLength(1);

    db.destroy();
  });

  it("will update item data with server version during push", async () => {
    const push = jest.fn(async (entity: TestOwnerEntity) => {
      return { ...entity, name: "From Server" };
    });
    const db = await createTestDb({
      syncMocks: {
        owner: {
          push,
        },
      },
    });

    const ownerEnt = db.entity(owner).create({ name: "Adam" });

    await waitForAllSyncToFlush();
    expect(ownerEnt.name).toBe("From Server");
    db.destroy();
  });

  it("will update item data with server version during push", async () => {
    const push = jest.fn(async (entity: TestOwnerEntity) => {
      return { ...entity, name: "From Server" };
    });
    const db = await createTestDb({
      syncMocks: {
        owner: {
          push,
        },
      },
    });

    const ownerEnt = db.entity(owner).create({ name: "Adam" });

    await waitForAllSyncToFlush();
    expect(ownerEnt.name).toBe("From Server");
    db.destroy();
  });
});
