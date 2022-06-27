import { createTestDb } from "./utils";

describe("clientdb misc", () => {
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

  it("asserts by id", async () => {
    const [db, data] = await getTestDb();

    expect(() => {
      db.owner.assertFindById("no-id", "no item");
    }).toThrow();

    expect(() => {
      db.owner.assertFindById(data.owners.adam.id, "no item");
    }).not.toThrow();

    db.destroy();
  });

  it("removes item", async () => {
    const [db, data] = await getTestDb();

    expect(data.owners.adam.dogs.all.length).toBe(2);

    data.dogs.adams_rex.remove();

    expect(data.owners.adam.dogs.all.length).toBe(1);

    db.destroy();
  });
});
