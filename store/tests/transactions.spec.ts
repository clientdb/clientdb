import { runTransaction, ClientDBTransaction } from "../transaction";
import { createTestDb, dog, owner } from "./utils";

function getTestDb() {
  const db = createTestDb();

  const adam = db.entity(owner).create({ name: "Adam" });
  const omar = db.entity(owner).create({ name: "Omar" });

  const adams_rex = db.entity(dog).create({ name: "rex", owner_id: adam.id });
  const adams_teddy = db
    .entity(dog)
    .create({ name: "teddy", owner_id: adam.id });

  const omars_rudy = db.entity(dog).create({ name: "rudy", owner_id: omar.id });
  const omars_rex = db.entity(dog).create({ name: "rex", owner_id: omar.id });

  return [
    db,
    {
      owners: { adam, omar },
      dogs: { adams_rex, adams_teddy, omars_rudy, omars_rex },
    },
  ] as const;
}

describe("clientdb transactions", () => {
  it("is optimistic", async () => {
    const [db, data] = await getTestDb();

    runTransaction(() => {
      db.entity(owner).create({ name: "A" });
      db.entity(owner).create({ name: "B" });
    });

    expect(db.entity(owner).count).toBe(4);
  });

  it("will not commit data if failed", async () => {
    const [db, data] = await getTestDb();

    try {
      runTransaction(() => {
        db.entity(owner).create({ name: "A" });
        db.entity(owner).create({ name: "B" });

        throw new Error("Failed");
      });
    } catch (error) {}

    expect(db.entity(owner).count).toBe(2);

    try {
      runTransaction(() => {
        data.owners.adam.remove();
        data.owners.omar.remove();

        throw new Error("Failed");
      });
    } catch (error) {}

    expect(db.entity(owner).count).toBe(2);
  });

  it("will allow manually rejecting transaction", async () => {
    const [db, data] = await getTestDb();

    const [, tr] = runTransaction(() => {
      db.entity(owner).create({ name: "A" });
      db.entity(owner).create({ name: "B" });
    });

    expect(db.entity(owner).count).toBe(4);

    tr.reject();

    expect(db.entity(owner).count).toBe(2);
  });

  it("will keep multiple transactions visible even if some are rejected", async () => {
    const [db, data] = await getTestDb();

    const adam = data.owners.adam;

    const [, changeToA] = runTransaction(() => {
      adam.update({ name: "A" });
    });

    const [, changeToB] = runTransaction(() => {
      adam.update({ name: "B" });
    });

    const [, changeToC] = runTransaction(() => {
      adam.update({ name: "C" });
    });

    expect(adam.name).toBe("C");
    changeToA.reject();
    expect(adam.name).toBe("C");
    changeToC.reject();
    expect(adam.name).toBe("B");
    changeToB.reject();
    expect(adam.name).toBe("Adam");
  });

  it("will emit transactions to db", () => {
    const [db, data] = getTestDb();

    let lastTr: ClientDBTransaction | null = null;

    const picker = jest.fn((tr: ClientDBTransaction) => {
      lastTr = tr;
    });

    db.events.on("transaction", (event) => picker(event.transaction));

    const { adam, omar } = data.owners;
    const { adams_rex, adams_teddy } = data.dogs;

    runTransaction(() => {
      adam.remove();
      omar.update({ name: "Omar2" });
      omar.remove();
    });

    expect(picker).toBeCalledTimes(1);
    expect(lastTr!.getChanges().map((change) => change.type))
      .toMatchInlineSnapshot(`
      Array [
        "removed",
        "updated",
        "removed",
      ]
    `);

    runTransaction(() => {
      adams_rex.remove();
    });

    expect(picker).toBeCalledTimes(2);
    expect(lastTr!.getChanges().map((change) => change.type))
      .toMatchInlineSnapshot(`
      Array [
        "removed",
      ]
    `);
  });

  it("will emit transactions to db one by one when mutations are not inside transactions", () => {
    const [db, data] = getTestDb();

    const picker = jest.fn();

    db.events.on("transaction", picker);

    const { adam } = data.owners;

    adam.remove();

    expect(picker).toBeCalledTimes(1);
  });
});
