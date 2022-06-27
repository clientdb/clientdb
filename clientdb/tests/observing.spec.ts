import { autorun, runInAction } from "mobx";

import { createTestDb } from "./utils";

describe("clientdb tracking", () => {
  async function getTestDb() {
    const db = await createTestDb();

    const adam = db.owner.create({ name: "Adam" });
    const omar = db.owner.create({ name: "Omar" });

    const adams_rex = db.dog.create({ name: "rex", owner_id: adam.id });
    const adams_teddy = db.dog.create({ name: "teddy", owner_id: adam.id });

    const omars_rudy = db.dog.create({ name: "rudy", owner_id: omar.id });
    const omars_rex = db.dog.create({ name: "rex", owner_id: omar.id });

    return [db, { owners: { adam, omar }, dogs: { adams_rex, adams_teddy, omars_rudy, omars_rex } }] as const;
  }

  it("observes deletes", async () => {
    const [db, data] = await getTestDb();

    const tracker = jest.fn(() => {
      return data.owners.adam.dogs.all.length;
    });

    const cancel = autorun(tracker);

    expect(tracker).toBeCalledTimes(1);
    expect(tracker).toHaveLastReturnedWith(2);

    data.dogs.adams_rex.remove();

    expect(tracker).toBeCalledTimes(2);
    expect(tracker).toHaveLastReturnedWith(1);

    cancel();
    db.destroy();
  });

  it("observes deletes via query", async () => {
    const [db, data] = await getTestDb();

    const tracker = jest.fn(() => {
      return db.dog.query({ owner_id: data.owners.omar.id }).all.length;
    });

    const cancel = autorun(tracker);

    expect(tracker).toBeCalledTimes(1);
    expect(tracker).toHaveLastReturnedWith(2);

    runInAction(() => {
      data.dogs.omars_rex.remove();
    });

    expect(tracker).toBeCalledTimes(2);
    expect(tracker).toHaveLastReturnedWith(1);

    cancel();
    db.destroy();
  });

  it("observes created items", async () => {
    const [db, data] = await getTestDb();

    const tracker = jest.fn(() => {
      return data.owners.adam.dogs.all.length;
    });

    const cancel = autorun(tracker);

    expect(tracker).toBeCalledTimes(1);
    expect(tracker).toHaveLastReturnedWith(2);

    db.dog.create({ name: "fox", owner_id: data.owners.adam.id });

    expect(tracker).toBeCalledTimes(2);
    expect(tracker).toHaveLastReturnedWith(3);

    cancel();
    db.destroy();
  });
});
