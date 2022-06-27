import { createClientDb, defineEntity } from "clientdb";
import { ClientDb } from "../entity/db";

import { TestOwnerEntity, createPersistanceAdapterMock, getDefaultCommonData, getSyncConfig } from "./utils";

const itemAdded = jest.fn();
const itemUpdated = jest.fn();
const itemRemoved = jest.fn();

const owner = defineEntity<TestOwnerEntity>({
  keyField: "id",
  keys: ["id", "name", "updatedAt"],
  updatedAtField: "updatedAt",
  name: "owner",
  sync: getSyncConfig<TestOwnerEntity>(),
  getDefaultValues: getDefaultCommonData,
}).addEventHandlers({
  itemAdded,
  itemUpdated,
  itemRemoved,
});

function createTestDb() {
  return createClientDb([owner],{ persistance: createPersistanceAdapterMock() });
}

const mockDbLinker: ClientDb = {
  getContextValue: expect.any(Function),
  entity: expect.any(Function),
  destroy: expect.any(Function),
};

describe("Event listeners", () => {
  beforeEach(() => {
    itemAdded.mockReset();
    itemUpdated.mockReset();
    itemRemoved.mockReset();
  });

  it("calls the item added method when item is created", async () => {
    const db = await createTestDb();

    const createdEntity = db.entity(owner).create({ name: "Rasputin" });

    expect(itemAdded).toBeCalledTimes(1);
    expect(itemAdded).toBeCalledWith(createdEntity, expect.objectContaining(mockDbLinker));
  });

  it("calls the item updated method when item is updated", async () => {
    const db = await createTestDb();

    const nameOnCreation = { name: "Rasputin" };
    const entity = db.entity(owner).create(nameOnCreation);

    entity.update({ name: "Pedro" });

    expect(itemUpdated).toBeCalledTimes(1);
    expect(itemUpdated).toBeCalledWith(
      entity,
      expect.objectContaining(nameOnCreation),
      expect.objectContaining(mockDbLinker)
    );
  });

  it("calls the item removed method when item is removed", async () => {
    const db = await createTestDb();

    const nameOnCreation = { name: "Rasputin" };
    const entity = db.entity(owner).create(nameOnCreation);

    entity.remove();

    expect(itemRemoved).toBeCalledTimes(1);
    expect(itemRemoved).toBeCalledWith(entity, expect.objectContaining(mockDbLinker));
  });
});
