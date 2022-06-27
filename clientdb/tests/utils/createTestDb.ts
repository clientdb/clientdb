import { createClientDb } from "clientdb";
import { AnyEntityDefinition, EntityDataByDefinition } from "clientdb/entity/definition";
import { typedKeys } from "../../entity/utils/object";

import { DefaultTestEntities, dog, owner } from "./entities";
import { createPersistanceAdapterMock, TablePersistanceMock } from "./persistance";
import { EntitySyncConfigMock } from "./sync";

type TestDbConfig = {
  entities?: AnyEntityDefinition[]
  syncMocks?: {
    [key in keyof DefaultTestEntities]?: EntitySyncConfigMock<DefaultTestEntities[key]>;
  };
  persistanceMocks?: {
    [key in keyof DefaultTestEntities]?: TablePersistanceMock<DefaultTestEntities[key]>;
  };
};

export function createTestDb( config?: TestDbConfig) {
  const persistance = createPersistanceAdapterMock({ tableMocks: config?.persistanceMocks });

  if (!config?.entities) {
    if (!config) config = {}

    config.entities = [dog,owner]
  }


  if (config?.syncMocks) {
    typedKeys(config.syncMocks).forEach((entityName) => {
      const syncMock = config?.syncMocks?.[entityName];

      const entityConfig = config?.entities?.find(entity => entity.config.name === entityName)?.config


      if (entityConfig && syncMock) {
        entityConfig.sync = { ...entityConfig.sync, ...syncMock };
      }
    });
  }

  return createClientDb( config.entities!, { persistance });
}
