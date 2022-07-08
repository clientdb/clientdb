import { createClientDb, defineEntity, ClientDb } from "@clientdb/store";

import { TestOwnerEntity, getDefaultCommonData } from "./utils";

const created = jest.fn();
const updated = jest.fn();
const removed = jest.fn();

const owner = defineEntity<TestOwnerEntity>({
  idField: "id",
  keys: ["id", "name", "updatedAt"],
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

  it("calls the item added method when item is created", async () => {
    const db = await createTestDb();

    const createdEntity = db.entity(owner).create({ name: "Rasputin" });

    expect(created).toBeCalledTimes(1);
    expect(created).toBeCalledWith(
      createdEntity,
      expect.objectContaining(mockDbLinker)
    );
  });

  it("calls the item updated method when item is updated", async () => {
    const db = await createTestDb();

    const nameOnCreation = { name: "Rasputin" };
    const entity = db.entity(owner).create(nameOnCreation);

    entity.update({ name: "Pedro" });

    expect(updated).toBeCalledTimes(1);
    expect(updated).toBeCalledWith(
      entity,
      expect.objectContaining({
        ...mockDbLinker,
        changedData: { name: "Pedro" },
        changedKeys: ["name"],
      })
    );
  });

  it("calls the item removed method when item is removed", async () => {
    const db = await createTestDb();

    const nameOnCreation = { name: "Rasputin" };
    const entity = db.entity(owner).create(nameOnCreation);

    entity.remove();

    expect(removed).toBeCalledTimes(1);
    expect(removed).toBeCalledWith(
      entity,
      expect.objectContaining(mockDbLinker)
    );
  });
});
