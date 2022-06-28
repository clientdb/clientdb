import { AnnotationsMap } from "mobx";

import { Entity } from "./entity";

import { ClientDb } from "./db";
import { EntityUpdateResult } from "./entity";
import { EntityFilterFunction, SortResult } from "./query";
import { EntitySearchConfig } from "./search";
import { EntitySyncConfig } from "./sync";
import { CleanupObject } from "./utils/cleanup";
import { getHash } from "./utils/hash";
import { PartialWithExplicitOptionals } from "./utils/types";

type EntityAccessValidator<Data, View> = (
  entity: Entity<Data, View>,
  db: ClientDb
) => boolean;

interface DefineEntityConfig<Data, View> {
  name: string;
  keys: Array<keyof Data>;
  keyField: keyof Data;
  updatedAtField: keyof Data;
  uniqueIndexes?: Array<keyof Data>;
  /**
   * We require optional values (null and undefined) to be explicitly provided.
   *
   * Context: entity has to include all the fields that are possible at creation time (even if they are 'undefined')
   * This is thus easy to create human-error when adding new optional field and not including it in default.
   * Later on entity would throw on creation as some field would be missing.
   *
   * Thus for { foo?: Maybe<string> } it would be required to provide { foo: null } as a default instead of {}
   */
  getDefaultValues?: (db: ClientDb) => PartialWithExplicitOptionals<Data>;
  sync: EntitySyncConfig<Data>;
  defaultSort?: (item: Data) => SortResult;
  customObservableAnnotations?: AnnotationsMap<Data, never>;
  /**
   * It is possible to define entity level rule deciding if given entity should be 'visible' via public api.
   *
   * This is useful for cases where we have some item locally, but we also manage permissions to see it locally.
   *
   * Aka 'soft permissions'.
   */
  accessValidator?: EntityAccessValidator<Data, View>;
  getView?: EntityDefinitionGetView<Data, View>;
  search?: EntitySearchConfig<Data>;
  events?: EntityEvents<Data, View>;
  functionalFilterCheck?: (
    item: Data,
    filter: EntityFilterFunction<Data, View>
  ) => void;
}

export type EntityEvents<Data, View> = {
  created?: (entity: Entity<Data, View>, db: ClientDb) => void;
  updated?: (
    entity: Entity<Data, View>,
    dataBefore: Data,
    db: ClientDb
  ) => void;
  removed?: (entity: Entity<Data, View>, db: ClientDb) => void;
};

export interface EntityDefinition<Data, View> {
  config: DefineEntityConfig<Data, View>;
  getSchemaHash(): string;
  addView<View>(
    getView: EntityDefinitionGetView<Data, View>
  ): EntityDefinition<Data, View>;
  addAccessValidation(
    accessValidator: EntityAccessValidator<Data, View>
  ): EntityDefinition<Data, View>;
  addEventHandlers(
    events: EntityEvents<Data, View>
  ): EntityDefinition<Data, View>;
}

export interface EntityViewLinker<Data> extends ClientDb {
  updateSelf(data: Partial<Data>): EntityUpdateResult;
  cleanup: CleanupObject;
}

type EntityDefinitionGetView<Data, View> = (
  item: Data,
  manager: EntityViewLinker<Data>
) => View;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EntityDataByDefinition<Def extends EntityDefinition<any, any>> =
  Def extends EntityDefinition<
    infer Data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? Data
    : never;

export type AnyEntityDefinition = EntityDefinition<any, any>;

export function defineEntity<Data extends {}, View extends {} = {}>(
  config: DefineEntityConfig<Data, View>
): EntityDefinition<Data, View> {
  return {
    config,

    // Schema hash is used to determine if data shape changed and full reload is needed
    getSchemaHash() {
      const sortedKeys = [...config.keys].sort();
      return getHash(sortedKeys.join(""));
    },
    addView<View>(getView: EntityDefinitionGetView<Data, View>) {
      return defineEntity<Data, View>({
        ...config,
        getView,
      } as DefineEntityConfig<Data, View>) as EntityDefinition<Data, View>;
    },
    addAccessValidation(validator) {
      return defineEntity({ ...config, accessValidator: validator });
    },
    addEventHandlers(events) {
      return defineEntity({ ...config, events });
    },
  };
}
