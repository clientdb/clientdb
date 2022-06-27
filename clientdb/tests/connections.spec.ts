import { createTestDb } from "./utils";

describe("clientdb query", () => {
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

  it("resolves relation", async () => {
    const [db, data] = await getTestDb();

    expect(data.dogs.adams_rex.owner).toBe(data.owners.adam);
    const adamsDogs = data.owners.adam.dogs.all;

    expect(adamsDogs).toContain(data.dogs.adams_rex);
    expect(adamsDogs).toContain(data.dogs.adams_teddy);
    expect(adamsDogs).toHaveLength(2);

    db.destroy();
  });

  it("resolves relation after updates", async () => {
    const [db, data] = await getTestDb();

    const adamsDogs = data.owners.adam.dogs;

    expect(adamsDogs.all).toHaveLength(2);

    data.dogs.omars_rex.update({ owner_id: data.owners.adam.id });

    expect(adamsDogs.all).toHaveLength(3);
    expect(adamsDogs.all).toContain(data.dogs.omars_rex);

    db.destroy();
  });
});
