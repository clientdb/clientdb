import { DefaultEntitiesMap, createTestDb, owner } from "./utils";

describe("search", () => {
  it("properly handles search", async () => {
    const db = await createTestDb();

    const adam = db.entity(owner).create({ name: "Adam" });
    db.entity(owner).create({ name: "Omar" });

    const results = db.entity(owner).search("Ad");

    expect(results).toEqual([adam]);
    db.destroy();
  });
});
