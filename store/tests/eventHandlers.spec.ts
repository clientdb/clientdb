import { createClientDb, defineEntity, ClientDb } from "@clientdb/store";

import { TestOwnerEntity, getDefaultCommonData } from "./utils";

const created = jest.fn();
const updated = jest.fn();
const removed = jest.fn();

const owner = defineEntity<TestOwnerEntity>({
  fields: ["id", "name", "updatedAt"],
  name: "owner",
  getDefaultValues: getDefaultCommonData,
}).addEventHandlers({
  created,
  updated,
  removed,
});

function createTestDb() {
  return createClientDb([owner]);
}

const mockDbLinker = {
  db: expect.any(Object),
};

describe("Event listeners", () => {
  beforeEach(() => {
    created.mockReset();
    updated.mockReset();
    removed.mockReset();
  });

  it("calls the item added method when item is created", () => {
    const db = createTestDb();

    const entity = db.entity(owner).create({ name: "Rasputin" });

    expect(created).toBeCalledTimes(1);
    expect(created).toBeCalledWith(
      expect.objectContaining({
        db: expect.any(Object),
        entity,
        type: "created",
      })
    );
  });

  it("calls the item updated method when item is updated", () => {
    const db = createTestDb();

    const nameOnCreation = { name: "Rasputin" };
    const entity = db.entity(owner).create(nameOnCreation);

    entity.update({ name: "Pedro" });

    expect(updated).toBeCalledTimes(1);
    expect(updated).toBeCalledWith(
      expect.objectContaining({
        db: expect.any(Object),
        entity,
        type: "updated",
        changes: { name: ["Rasputin", "Pedro"] },
      })
    );
  });

  it("calls the item removed method when item is removed", () => {
    const db = createTestDb();

    const nameOnCreation = { name: "Rasputin" };
    const entity = db.entity(owner).create(nameOnCreation);

    entity.remove();

    expect(removed).toBeCalledTimes(1);
    expect(removed).toBeCalledWith(
      expect.objectContaining({
        db: expect.any(Object),
        entity,
        type: "removed",
      })
    );
  });
});
