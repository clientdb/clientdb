import { AnnotationsMap, IComputedValue } from "mobx";

import { Entity } from "clientdb";

import { DatabaseLinker } from "./entitiesConnections";
import { EntityUpdateResult } from "./entity";
import { EntityFilterFunction, SortResult } from "./query";
import { EntitySearchConfig } from "./search";
import { EntitySyncConfig } from "./sync";
import { PartialWithExplicitOptionals } from "./utils/types";
import { CleanupObject } from "./utils/cleanup";
import { getHash } from "./utils/hash";

type EntityAccessValidator<Data, Connections> = (entity: Entity<Data, Connections>, linker: DatabaseLinker) => boolean;

interface DefineEntityConfig<Data, Connections> {
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
  getDefaultValues?: (linker: DatabaseLinker) => PartialWithExplicitOptionals<Data>;
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
  accessValidator?: EntityAccessValidator<Data, Connections>;
  getConnections?: EntityDefinitionGetConnections<Data, Connections>;
  search?: EntitySearchConfig<Data>;
  events?: EntityUserEvents<Data, Connections>;
  functionalFilterCheck?: (item: Data, filter: EntityFilterFunction<Data, Connections>) => void;
}

export type EntityUserEvents<Data, Connections> = {
  itemAdded?: (entity: Entity<Data, Connections>, linker: DatabaseLinker) => void;
  itemUpdated?: (entity: Entity<Data, Connections>, dataBefore: Data, linker: DatabaseLinker) => void;
  itemRemoved?: (entity: Entity<Data, Connections>, linker: DatabaseLinker) => void;
};

export interface EntityDefinition<Data, Connections> {
  config: DefineEntityConfig<Data, Connections>;
  getSchemaHash(): string;
  addConnections<AddedConnections>(
    getConnections: EntityDefinitionGetConnections<Data, AddedConnections>
  ): EntityDefinition<Data, AddedConnections>;
  addAccessValidation(accessValidator: EntityAccessValidator<Data, Connections>): EntityDefinition<Data, Connections>;
  addEventHandlers(events: EntityUserEvents<Data, Connections>): EntityDefinition<Data, Connections>;
}

export interface EntityConnectionsLinker<Data> extends DatabaseLinker {
  updateSelf(data: Partial<Data>): EntityUpdateResult;
  cleanup: CleanupObject;
}

type EntityDefinitionGetConnections<Data, Connections> = (
  item: Data,
  manager: EntityConnectionsLinker<Data>
) => Connections;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EntityDataByDefinition<Def extends EntityDefinition<any, any>> = Def extends EntityDefinition<
  infer Data,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>
  ? Data
  : never;

export function defineEntity<Data extends {}, Connections extends {} = {}>(
  config: DefineEntityConfig<Data, Connections>
): EntityDefinition<Data, Connections> {
  return {
    config,

    // Schema hash is used to determine if data shape changed and full reload is needed
    getSchemaHash() {
      const sortedKeys = [...config.keys].sort();
      return getHash(sortedKeys.join(""));
    },
    addConnections<AddedConnections>(getConnections: EntityDefinitionGetConnections<Data, AddedConnections>) {
      return defineEntity<Data, AddedConnections>({ ...config, getConnections } as DefineEntityConfig<
        Data,
        AddedConnections
      >) as EntityDefinition<Data, AddedConnections>;
    },
    addAccessValidation(validator) {
      return defineEntity({ ...config, accessValidator: validator });
    },
    addEventHandlers(events) {
      return defineEntity({ ...config, events });
    },
  };
}
