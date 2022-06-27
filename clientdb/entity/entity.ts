import { isEqual, pick } from "lodash";
import { action, computed, extendObservable, makeAutoObservable, runInAction, toJS } from "mobx";

import { waitForEntityAllAwaitingPushOperations } from "clientdb";

import { EntityDefinition } from "./definition";
import { EntityStore } from "./store";
import { EntityChangeSource } from "./types";
import { CleanupObject, createCleanupObject } from "./utils/cleanup";
import { typedKeys } from "./utils/object";
import { assert } from "../utils/assert";
import { ClientDb } from "./db";

export interface EntityUpdateResult {
  hadChanges: boolean;
  undo: (source?: EntityChangeSource) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type EntityMethods<Data, View> = {
  update(data: Partial<Data>, source?: EntityChangeSource): EntityUpdateResult;
  getData(): Data;
  getKey(): string;
  getKeyName(): string;
  getUpdatedAt(): Date;
  remove(source?: EntityChangeSource): void;
  isRemoved(): boolean;
  waitForSync(): Promise<void>;
  definition: EntityDefinition<Data, View>;
  db: ClientDb;
  cleanup: CleanupObject;
};

export type Entity<Data, View> = Data & View & EntityMethods<Data, View>;

export type EntityByDefinition<Def> = Def extends EntityDefinition<infer Data, infer View>
  ? Entity<Data, View>
  : never;

export interface CreateEntityConfig {
  needsSync: boolean;
}

interface CreateEntityInput<D, V> {
  data: Partial<D>;
  definition: EntityDefinition<D, V>;
  store: EntityStore<D, V>;
  db: ClientDb;
}

export function createEntity<D, V>({ data, definition, store, db }: CreateEntityInput<D, V>): Entity<D, V> {
  const { config } = definition;
  const dataWithDefaults: D = { ...config.getDefaultValues?.(db), ...data } as D;

  const rawDataKeys = typedKeys(dataWithDefaults);

  for (const requiredKey of config.keys ?? []) {
    assert(
      rawDataKeys.includes(requiredKey),
      `Required field "${requiredKey as string}" is missing when creating new entity ${definition.config.name}`
    );
  }

  const initialKey = data[config.keyField];

  const observableData = makeAutoObservable<D & object>(
    dataWithDefaults as D & object,
    config.customObservableAnnotations,
    {
      name: `${definition.config.name}-${initialKey}`,
    }
  );

  const cleanupObject = createCleanupObject();

  const connections =
    config.getView?.(observableData, {
      ...db,
      updateSelf(data) {
        return entity.update(data, "user");
      },
      cleanup: cleanupObject,
    }) ?? ({} as V);

  // Note: we dont want to add connections as {...data, ...connections}. Connections might have getters so it would simply unwrap them.

  const observableDataAndConnections = extendObservable(observableData, connections);

  function touchUpdatedAt() {
    // We dont know weather updated at is kept as date, string, or number stamp. Let's try to keep the type the same
    const existingDate = entity[config.updatedAtField];

    if (typeof existingDate === "string") {
      Reflect.set(entity, config.updatedAtField, new Date().toISOString());
      return;
    }

    if (typeof existingDate === "number") {
      Reflect.set(entity, config.updatedAtField, new Date().getTime());
      return;
    }

    Reflect.set(entity, config.updatedAtField, new Date());
  }

  const entityMethods: EntityMethods<D, V> = {
    definition,
    db: db,
    cleanup: cleanupObject,
    remove(source) {
      store.removeById(entityMethods.getKey(), source);
    },
    isRemoved() {
      return !store.findById(entityMethods.getKey());
    },
    waitForSync() {
      return waitForEntityAllAwaitingPushOperations(entity);
    },
    getKey() {
      return `${entity[config.keyField]}`;
    },
    getKeyName() {
      return config.keyField as string;
    },
    getUpdatedAt() {
      const rawInfo = entity[config.updatedAtField];

      const updatedAt = new Date(rawInfo as unknown as string);

      if (isNaN(updatedAt.getTime())) {
        console.error({ entity });
        throw new Error(`Incorrect updated at value for key "${config.updatedAtField as string}"`);
      }

      return updatedAt;
    },
    getData() {
      const rawObject = toJS(entity);
      return pick(rawObject, rawDataKeys);
    },
    update(input, source: EntityChangeSource = "user"): EntityUpdateResult {
      const changedKeys = typedKeys(input).filter((keyToUpdate) => {
        const value = input[keyToUpdate];
        if (value === undefined) return false;

        const existingValue = entity[keyToUpdate];

        return !isEqual(value, existingValue);
      });

      // No changes will be made, return early
      if (!changedKeys.length)
        return {
          hadChanges: false,
          undo: () => void 0,
        };

      const dataBeforeUpdate = entity.getData();

      const undoData = pick(dataBeforeUpdate, changedKeys);

      store.events.emit("itemWillUpdate", entity, input, source);

      runInAction(() => {
        changedKeys.forEach((keyToUpdate) => {
          const value = input[keyToUpdate];
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          (entity as D)[keyToUpdate] = value!;
        });

        touchUpdatedAt();
      });

      store.events.emit("itemUpdated", entity, dataBeforeUpdate, source);

      return {
        hadChanges: true,
        undo(source = "user") {
          entityMethods.update(undoData, source);
        },
      };
    },
  };

  const entity: Entity<D, V> = extendObservable(observableDataAndConnections, entityMethods, {
    getData: false,
    getKey: false,
    getKeyName: false,
    getUpdatedAt: false,
    definition: false,
    waitForSync: false,
    remove: action,
    update: action,
    db: false,
  });

  return entity;
}
