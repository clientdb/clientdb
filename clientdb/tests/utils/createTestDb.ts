import { createClientDb } from "clientdb";
import { EntityDataByDefinition } from "clientdb/entity/definition";
import { EntitiesMap } from "clientdb/entity/entitiesMap";
import { typedKeys } from "../../entity/utils/object";

import { dog, owner, testEntities } from "./entities";
import { TablePersistanceMock, createPersistanceAdapterMock } from "./persistance";
import { EntitySyncConfigMock } from "./sync";

type TestDbConfig<M extends EntitiesMap = typeof testEntities> = {
  entities?: M;
  syncMocks?: {
    [key in keyof M]?: EntitySyncConfigMock<EntityDataByDefinition<M[key]>>;
  };
  persistanceMocks?: {
    [key in keyof M]?: TablePersistanceMock<EntityDataByDefinition<M[key]>>;
  };
};

export function createTestDb<M extends EntitiesMap = typeof testEntities>(config?: TestDbConfig<M>) {
  const db = createPersistanceAdapterMock({ tableMocks: config?.persistanceMocks });
  const entities: M = config?.entities ?? ({ owner, dog } as unknown as M);

  if (config?.syncMocks) {
    typedKeys(config.syncMocks).forEach((entityName) => {
      const syncMock = config.syncMocks?.[entityName];

      const entityConfig = entities?.[entityName as keyof M]?.config;

      if (entityConfig && syncMock) {
        entityConfig.sync = { ...entityConfig.sync, ...syncMock };
      }
    });
  }

  return createClientDb({ db }, entities);
}
