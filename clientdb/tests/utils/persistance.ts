import { PersistanceAdapterInfo, PersistanceTableAdapter } from "clientdb";

import { DefaultTestEntities } from "./entities";

export type TablePersistanceMock<D> = Partial<PersistanceTableAdapter<D>>;

interface PersistanceAdapterMockConfig {
  tableMocks?: {
    [key in keyof DefaultTestEntities]?: TablePersistanceMock<
      DefaultTestEntities[key]
    >;
  };
}

export function createPersistanceAdapterMock(
  config?: PersistanceAdapterMockConfig
) {
  const mockPersistanceAdapter: PersistanceAdapterInfo = {
    adapter: {
      async openDB() {
        return {
          async close() {
            //
          },
          async getTable<Data>(name: string) {
            const typedName = name as keyof DefaultTestEntities;

            const mockedMethods = config?.tableMocks?.[
              typedName
            ] as unknown as Partial<PersistanceTableAdapter<Data>>;

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
