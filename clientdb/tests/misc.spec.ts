import { createTestDb, dog, owner } from "./utils";

describe("clientdb misc", () => {
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

  it("asserts by id", async () => {
    const [db, data] = await getTestDb();

    expect(() => {
      db.entity(owner).assertFindById("no-id", "no item");
    }).toThrow();

    expect(() => {
      db.entity(owner).assertFindById(data.owners.adam.id, "no item");
    }).not.toThrow();

    db.destroy();
  });

  it("removes item", async () => {
    const [db, data] = await getTestDb();

    expect(data.owners.adam.dogs.all.length).toBe(2);

    expect(data.dogs.adams_rex.isRemoved()).toBe(false);

    data.dogs.adams_rex.remove();

    expect(data.owners.adam.dogs.all.length).toBe(1);
    expect(data.dogs.adams_rex.isRemoved()).toBe(true);

    db.destroy();
  });

  it("will prevent breaking unique index", async () => {
    const [db] = await getTestDb();

    expect(() => {
      db.entity(owner).create({ name: "Adam" });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Entity \\"owner\\" with unique property \\"name\\"=\\"Adam\\" already exists"`
    );
  });

  it("will prevent duplicating id", async () => {
    const [db, data] = await getTestDb();

    expect(() => {
      db.entity(owner).create({ name: "Adam 2", id: data.owners.adam.id });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Cannot create entity \\"owner\\" with id \\"${data.owners.adam.id}\\" because it already exists"`
    );
  });

  it("will prevent updating id", async () => {
    const [db, data] = await getTestDb();

    expect(() => {
      data.owners.adam.update({ id: "new-id" });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Cannot update id field of entity \\"owner\\""`
    );
  });

  it("will properly undo update", async () => {
    const [db, data] = await getTestDb();

    const undo = data.owners.adam.update({ name: "Not Adam" }).undo;

    expect(data.owners.adam.name).toBe("Not Adam");

    undo();

    expect(data.owners.adam.name).toBe("Adam");
  });

  it("will properly detect empty update", async () => {
    const [db, data] = await getTestDb();

    expect(data.owners.adam.update({ name: "Adam" }).hadChanges).toBe(false);
    expect(data.owners.adam.update({ name: "Adam2" }).hadChanges).toBe(true);
  });
});
