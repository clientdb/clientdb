import { EntitySyncConfig } from "clientdb/sync";

export type EntitySyncConfigMock<T> = Partial<EntitySyncConfig<T>>;

export function getSyncConfig<T>(
  mocks?: EntitySyncConfigMock<T>
): EntitySyncConfig<T> {
  return {
    pullUpdated({ updateItems }) {
      updateItems([]);
    },
    ...mocks,
  };
}
