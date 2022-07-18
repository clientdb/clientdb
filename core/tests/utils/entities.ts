import { defineEntity } from "@clientdb/core";

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

export const owner = defineEntity<TestOwnerEntity>({
  fields: ["id", "name", "updatedAt", "hide"],
  uniqueProps: ["name"],
  name: "owner",
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
  fields: ["id", "name", "updatedAt", "owner_id"],
  name: "dog",
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
