import {
  autorunOnce,
  createTestDb,
  dog,
  owner,
  runObserved,
  TestOwnerEntity,
} from "./utils";

describe("clientdb query", () => {
  async function getTestDb() {
    const db = await createTestDb();

    const adam = db.entity(owner).create({ name: "Adam" });
    const omar = db.entity(owner).create({ name: "Omar" });

    const adams_rex = db.entity(dog).create({ name: "rex", owner_id: adam.id });
    const adams_teddy = db
      .entity(dog)
      .create({ name: "teddy", owner_id: adam.id });

    const omars_rudy = db
      .entity(dog)
      .create({ name: "rudy", owner_id: omar.id });
    const omars_rex = db.entity(dog).create({ name: "rex", owner_id: omar.id });

    return [
      db,
      {
        owners: { adam, omar },
        dogs: { adams_rex, adams_teddy, omars_rudy, omars_rex },
      },
    ] as const;
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

    expect(
      db.entity(owner).sort({ sort: (owner) => owner.name, direction: "asc" })
        .all
    ).toEqual([omar, adam]);
    expect(
      db.entity(owner).sort({ sort: (owner) => owner.name, direction: "desc" })
        .all
    ).toEqual([adam, omar]);

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

  it("performs $or query", async () => {
    const [db, data] = await getTestDb();

    const ownerQuery = db.entity(owner).query;

    const {
      owners: { adam, omar },
    } = data;

    expect(
      ownerQuery({ $or: [{ name: "Adam" }, { name: "Omar" }] }).all
    ).toEqual([adam, omar]);

    expect(
      ownerQuery({ name: "Adam", $or: [{ name: "Adam" }, { name: "Omar" }] })
        .all
    ).toEqual([adam]);

    expect(
      ownerQuery({ name: "Nope", $or: [{ name: "Adam" }, { name: "Omar" }] })
        .all
    ).toEqual([]);

    db.destroy();
  });

  it("performs nested query", async () => {
    const [db, data] = await getTestDb();

    expect(
      db.entity(owner).query({ name: "Adam" }).query({ dogsCount: 2 }).count
    ).toBe(1);

    expect(
      db.entity(owner).query({ name: "Adam" }).query({ dogsCount: 1 }).count
    ).toBe(0);

    expect(
      db.entity(owner).query({ name: "Nope" }).query({ dogsCount: 2 }).count
    ).toBe(0);
  });

  it("reuses query", async () => {
    const [db, data] = await getTestDb();
    const checker = jest.fn((owner: TestOwnerEntity) => owner.name === "Adam");
    const checker2 = jest.fn((owner: TestOwnerEntity) => owner.name === "Adam");

    const ownersCount = db.entity(owner).all.length;

    autorunOnce(() => {
      db.entity(owner).query(checker).all;
      db.entity(owner).query(checker).all;
      db.entity(owner).query(checker).all;
      db.entity(owner).query(checker).all;

      db.entity(owner).query(checker2).all;
      db.entity(owner).query(checker2).all;
      db.entity(owner).query(checker2).all;
      db.entity(owner).query(checker2).all;
    });

    expect(checker).toBeCalledTimes(ownersCount);
    expect(checker2).toBeCalledTimes(ownersCount);
  });

  it("reuses filter on nested query", async () => {
    const [db, data] = await getTestDb();
    const checker = jest.fn((owner: TestOwnerEntity) => owner.name === "Adam");

    autorunOnce(() => {
      db.entity(owner).query({ name: "Adam" }).query(checker).all;
      db.entity(owner).query({ name: "Adam" }).query(checker).all;
      db.entity(owner).query({ name: "Adam" }).query(checker).all;
      db.entity(owner).query({ name: "Adam" }).query(checker).all;
    });

    expect(checker).toBeCalledTimes(1);
    expect(db.entity(owner).query({ name: "Adam" }).query(checker).all).toEqual(
      [data.owners.adam]
    );
  });
});
