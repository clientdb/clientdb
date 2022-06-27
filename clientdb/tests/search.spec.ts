import { DefaultEntitiesMap, createTestDb } from "./utils";

describe("search", () => {
  it("properly handles search", async () => {
    const db = await createTestDb<DefaultEntitiesMap>();

    const adam = db.owner.create({ name: "Adam" });
    db.owner.create({ name: "Omar" });

    const results = db.owner.search("Ad");

    expect(results).toEqual([adam]);
    db.destroy();
  });
});
