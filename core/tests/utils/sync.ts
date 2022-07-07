import { EntitySyncConfig } from "clientdb/entity";

export type EntitySyncConfigMock<T> = Partial<EntitySyncConfig<T>>;

export function getSyncConfig<T>(mocks?: EntitySyncConfigMock<T>): EntitySyncConfig<T> {
  return {
    pullUpdated({ updateItems }) {
      updateItems([]);
    },
    ...mocks,
  };
}
