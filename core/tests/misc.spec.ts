import { createTestDb, dog, owner } from "./utils";

describe("clientdb misc", () => {
  function getTestDb() {
    const db = createTestDb();

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

  it("removes item", () => {
    const [db, data] = getTestDb();

    expect(data.owners.adam.dogs.all.length).toBe(2);

    expect(data.dogs.adams_rex.isRemoved()).toBe(false);

    data.dogs.adams_rex.remove();

    expect(data.owners.adam.dogs.all.length).toBe(1);
    expect(data.dogs.adams_rex.isRemoved()).toBe(true);

    db.destroy();
  });

  it("will prevent breaking unique index", () => {
    const [db] = getTestDb();

    expect(() => {
      db.entity(owner).create({ name: "Adam" });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Entity \\"owner\\" with unique property \\"name\\"=\\"Adam\\" already exists"`
    );
  });

  it("will prevent duplicating id", () => {
    const [db, data] = getTestDb();

    expect(() => {
      db.entity(owner).create({ name: "Adam 2", id: data.owners.adam.id });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Cannot create entity \\"owner\\" with id \\"${data.owners.adam.id}\\" because it already exists"`
    );
  });

  it("will prevent updating id", () => {
    const [db, data] = getTestDb();

    expect(() => {
      data.owners.adam.update({ id: "new-id" });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Cannot update id field of entity \\"owner\\""`
    );
  });

  it("will properly undo update", () => {
    const [db, data] = getTestDb();

    const undo = data.owners.adam.update({ name: "Not Adam" }).rollback;

    expect(data.owners.adam.name).toBe("Not Adam");

    undo();

    expect(data.owners.adam.name).toBe("Adam");
  });

  it("will properly detect empty update", () => {
    const [db, data] = getTestDb();

    expect(data.owners.adam.update({ name: "Adam" }).changes).toEqual({});
    expect(data.owners.adam.update({ name: "Adam2" }).changes).toEqual({
      name: ["Adam", "Adam2"],
    });
  });

  it("will exclude items not passing root filter", () => {
    const [db, data] = getTestDb();

    const owners = db.entity(owner);

    data.owners.adam.update({ hide: true });

    expect(owners.all).toEqual([data.owners.omar]);
    expect(owners.findById(data.owners.adam.id)).toBeNull();
    expect(owners.query({ name: "Adam" }).count).toBe(0);

    data.owners.adam.update({ hide: false });

    expect(owners.all).toEqual([data.owners.adam, data.owners.omar]);
    expect(owners.findById(data.owners.adam.id)).not.toBeNull();
    expect(owners.query({ name: "Adam" }).count).toBe(1);
  });
});
