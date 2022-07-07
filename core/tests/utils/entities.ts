import { EntitySyncConfig, defineEntity } from "clientdb";

interface CommonData {
  id: string;
  updatedAt: Date;
}

export interface TestOwnerEntity extends CommonData {
  name: string;
  hide: boolean;
}

export interface TestDogEntity extends CommonData {
  name: string;
  owner_id: string;
}

export type DefaultTestEntities = {
  owner: TestOwnerEntity;
  dog: TestDogEntity;
};

let id = 0;

export function getDefaultCommonData(): CommonData {
  return {
    id: `${++id}`,
    updatedAt: new Date(),
  };
}

function getSyncConfig<T>(): EntitySyncConfig<T> {
  return {
    pullUpdated({ updateItems }) {
      updateItems([]);
    },
  };
}

export const owner = defineEntity<TestOwnerEntity>({
  idField: "id",
  keys: ["id", "name", "updatedAt"],
  uniqueProps: ["name"],
  updatedAtField: "updatedAt",
  name: "owner",
  sync: getSyncConfig<TestOwnerEntity>(),
  search: {
    fields: {
      name: true,
    },
  },
  defaultSort: (owner) => owner.name,
  getDefaultValues: () => {
    return { ...getDefaultCommonData(), hide: false };
  },
})
  .addView((ownerData, { db: { entity } }) => {
    return {
      get dogs() {
        return entity(dog).query({ owner_id: ownerData.id });
      },
      get dogsCount() {
        return entity(dog).query({ owner_id: ownerData.id }).count;
      },
    };
  })
  .addRootFilter((owner) => !owner.hide);

export const dog = defineEntity<TestDogEntity>({
  idField: "id",
  keys: ["id", "name", "updatedAt", "owner_id"],
  updatedAtField: "updatedAt",
  name: "dog",
  sync: getSyncConfig<TestDogEntity>(),
  getDefaultValues: getDefaultCommonData,
}).addView((dogData, { db: { entity } }) => {
  return {
    get owner() {
      return entity(owner).findById(dogData.owner_id)!;
    },
  };
});

export const testEntities = {
  dog,
  owner,
};

export type DefaultEntitiesMap = typeof testEntities;

export type DefaultTestEntitiesData = {
  owner: TestOwnerEntity;
  dog: TestDogEntity;
};
