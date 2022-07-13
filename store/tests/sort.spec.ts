import { createTestDb, dog, owner } from "./utils";

describe("clientdb sorting", () => {
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

  it("properly updates default order of owner.name", async () => {
    const [db, data] = getTestDb();

    expect(db.entity(owner).all).toEqual([data.owners.adam, data.owners.omar]);

    data.owners.adam.update({ name: "Zadam" });

    expect(db.entity(owner).all).toEqual([data.owners.omar, data.owners.adam]);

    db.destroy();
  });

  it("handles custom sorter", async () => {
    const [db, data] = getTestDb();

    const byDogsCount = db.entity(owner).sort((owner) => -owner.dogsCount);

    expect(byDogsCount.all).toEqual([data.owners.adam, data.owners.omar]);

    data.owners.adam.dogs.first?.remove();

    expect(byDogsCount.all).toEqual([data.owners.omar, data.owners.adam]);
  });
});
