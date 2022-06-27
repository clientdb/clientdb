import { createTestDb, dog, owner, runObserved } from "./utils";

describe("clientdb query", () => {
  async function getTestDb() {
    const db = await createTestDb();

    const adam = db.entity(owner).create({ name: "Adam" });
    const omar = db.entity(owner).create({ name: "Omar" });

    const adams_rex = db.entity(dog).create({ name: "rex", owner_id: adam.id });
    const adams_teddy = db.entity(dog).create({ name: "teddy", owner_id: adam.id });

    const omars_rudy = db.entity(dog).create({ name: "rudy", owner_id: omar.id });
    const omars_rex = db.entity(dog).create({ name: "rex", owner_id: omar.id });

    return [db, { owners: { adam, omar }, dogs: { adams_rex, adams_teddy, omars_rudy, omars_rex } }] as const;
  }

  it("performs query", async () => {
    const [db] = await getTestDb();

    const queryFunction = jest.fn((owner: { name: string }) => {
      return owner.name === "Adam";
    });

    const query = db.entity(owner).query(queryFunction);

    // Query fn is only cached as long as being observed.
    runObserved(() => {
      // Query should be lazy
      expect(queryFunction).toBeCalledTimes(0);

      expect(query.all).toHaveLength(1);

      expect(queryFunction).toBeCalledTimes(db.entity(owner).all.length);

      expect(query.all).toHaveLength(1);

      expect(queryFunction).toBeCalledTimes(db.entity(owner).all.length);
    });

    db.destroy();
  });

  it("properly sorts results", async () => {
    const [db, data] = await getTestDb();

    const {
      owners: { adam, omar },
    } = data;

    expect(db.entity(owner).sort({ sort: (owner) => owner.name, direction: "asc" }).all).toEqual([omar, adam]);
    expect(db.entity(owner).sort({ sort: (owner) => owner.name, direction: "desc" }).all).toEqual([adam, omar]);

    db.destroy();
  });

  it("properly returns query meta results", async () => {
    const [db, data] = await getTestDb();

    const {
      owners: { adam, omar },
    } = data;

    const allOwnersQuery = db.entity(owner).query(() => true);

    expect(allOwnersQuery.hasItems).toBe(true);
    expect(allOwnersQuery.first).toBe(adam);
    expect(allOwnersQuery.last).toBe(omar);
    expect(allOwnersQuery.count).toBe(2);

    const emptyQuery = db.entity(owner).query(() => false);

    expect(emptyQuery.hasItems).toBe(false);
    expect(emptyQuery.first).toBe(null);
    expect(emptyQuery.last).toBe(null);
    expect(emptyQuery.count).toBe(0);

    db.destroy();
  });
});
