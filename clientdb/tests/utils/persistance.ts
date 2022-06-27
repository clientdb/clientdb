import { PersistanceAdapterInfo, PersistanceTableAdapter } from "clientdb";

import { TestDogEntity, TestOwnerEntity } from "./entities";

export type TablePersistanceMock<D> = Partial<PersistanceTableAdapter<D>>;

type DefaultTestEntities = {
  owner: TestOwnerEntity;
  dog: TestDogEntity;
};

interface PersistanceAdapterMockConfig<EntitiesMap = DefaultTestEntities> {
  tableMocks?: {
    [key in keyof EntitiesMap]?: TablePersistanceMock<EntitiesMap[key]>;
  };
}

export function createPersistanceAdapterMock<EntitiesDataMap = DefaultTestEntities>(
  config?: PersistanceAdapterMockConfig<EntitiesDataMap>
) {
  const mockPersistanceAdapter: PersistanceAdapterInfo = {
    adapter: {
      async openDB() {
        return {
          async close() {
            //
          },
          async getTable<Data>(name: string) {
            const typedName = name as keyof EntitiesDataMap;

            const mockedMethods = config?.tableMocks?.[typedName] as unknown as Partial<PersistanceTableAdapter<Data>>;

            return {
              async clearTable() {
                return true;
              },
              async fetchAllItems() {
                return [];
              },
              async fetchItem() {
                return null;
              },
              async removeItem() {
                return true;
              },
              async removeItems() {
                return true;
              },
              async saveItem() {
                return true;
              },
              async saveItems() {
                return true;
              },
              async updateItem() {
                return true;
              },
              ...mockedMethods,
            };
          },
        };
      },
      async removeDB() {
        return true;
      },
    },
  };

  return mockPersistanceAdapter;
}
