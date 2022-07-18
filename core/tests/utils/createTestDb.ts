import { AnyEntityDefinition, createClientDb } from "@clientdb/core";

import { dog, owner } from "./entities";

type TestDbConfig = {
  entities?: AnyEntityDefinition[];
};

export function createTestDb(config?: TestDbConfig) {
  if (!config?.entities) {
    if (!config) config = {};

    config.entities = [dog, owner];
  }

  return createClientDb(config.entities!);
}
