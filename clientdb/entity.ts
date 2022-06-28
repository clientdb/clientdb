import { isEqual, pick } from "lodash";
import {
  action,
  computed,
  extendObservable,
  makeAutoObservable,
  runInAction,
  toJS,
} from "mobx";

import { waitForEntityAllAwaitingPushOperations } from "clientdb";

import { EntityDefinition, EntityViewLinker } from "./definition";
import { EntityStore } from "./store";
import { EntityChangeSource } from "./types";
import { CleanupObject, createCleanupObject } from "./utils/cleanup";
import { typedKeys } from "./utils/object";
import { assert } from "./utils/assert";
import { ClientDb } from "./db";

export interface EntityUpdateResult {
  hadChanges: boolean;
  undo: (source?: EntityChangeSource) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type EntityMethods<Data, View> = {
  update(data: Partial<Data>, source?: EntityChangeSource): EntityUpdateResult;
  getData(): Data;
  getId(): string;
  getIdPropName(): string;
  getUpdatedAt(): Date;
  remove(source?: EntityChangeSource): void;
  isRemoved(): boolean;
  waitForSync(): Promise<void>;
  definition: EntityDefinition<Data, View>;
  db: ClientDb;
  cleanup: CleanupObject;
};

export type Entity<Data, View> = Data & View & EntityMethods<Data, View>;

export type EntityByDefinition<Def> = Def extends EntityDefinition<
  infer Data,
  infer View
>
  ? Entity<Data, View>
  : never;

export interface CreateEntityConfig {
  needsSync: boolean;
}

interface CreateEntityInput<D, V> {
  data: Partial<D>;
  store: EntityStore<D, V>;
}

function assertDataHasAllFields<D>(
  data: D,
  definition: EntityDefinition<D, any>
) {
  const rawDataKeys = typedKeys(data);

  for (const requiredKey of definition.config.keys ?? []) {
    assert(
      rawDataKeys.includes(requiredKey),
      `Required field "${
        requiredKey as string
      }" is missing when creating new entity ${definition.config.name}`
    );
  }
}

function fillDataDefaults<D>(data: Partial<D>, store: EntityStore<D, any>): D {
  const { definition, db } = store;

  const { config } = definition;

  if (!definition.config.getDefaultValues) {
    return data as D;
  }
  const dataWithDefaults = {
    ...config.getDefaultValues?.(db),
    ...data,
  } as D;

  return dataWithDefaults;
}

export function createEntity<D, V>({
  data,
  store,
}: CreateEntityInput<D, V>): Entity<D, V> {
  const { definition, db } = store;

  const { config } = definition;
  const dataWithDefaults = fillDataDefaults(data, store);

  assertDataHasAllFields(dataWithDefaults, definition);

  const initialKey = data[config.idField];

  const observableData = makeAutoObservable<D & object>(
    dataWithDefaults as D & object,
    config.customObservableAnnotations,
    {
      name: `${definition.config.name}-${initialKey}`,
    }
  );

  const cleanupObject = createCleanupObject();

  const viewLinker: EntityViewLinker<D> = {
    db,
    updateSelf(data) {
      return entity.update(data, "user");
    },
    cleanup: cleanupObject,
  };

  const view = config.getView?.(observableData, viewLinker) ?? ({} as V);

  // Note: we dont want to add view as {...data, ...connections}. Connections might have getters so it would simply unwrap them.
  const observableDataAndView = extendObservable(observableData, view);

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
      store.removeById(entityMethods.getId(), source);
    },
    isRemoved() {
      return !store.findById(entityMethods.getId());
    },
    waitForSync() {
      return waitForEntityAllAwaitingPushOperations(entity);
    },
    getId() {
      return `${entity[config.idField]}`;
    },
    getIdPropName() {
      return config.idField as string;
    },
    getUpdatedAt() {
      const rawInfo = entity[config.updatedAtField];

      const updatedAt = new Date(rawInfo as unknown as string);

      if (isNaN(updatedAt.getTime())) {
        console.error({ entity });
        throw new Error(
          `Incorrect updated at value for key "${
            config.updatedAtField as string
          }"`
        );
      }

      return updatedAt;
    },
    getData() {
      const rawObject = toJS(entity);
      return pick(rawObject, definition.config.keys);
    },
    update(input, source: EntityChangeSource = "user"): EntityUpdateResult {
      const changedKeys = typedKeys(input).filter((keyToUpdate) => {
        const value = input[keyToUpdate];
        if (value === undefined) return false;

        const existingValue = entity[keyToUpdate];

        return !isEqual(value, existingValue);
      });

      if (changedKeys.includes(config.idField)) {
        throw new Error(
          `Cannot update id field of entity "${definition.config.name}"`
        );
      }

      // No changes will be made, return early
      if (!changedKeys.length)
        return {
          hadChanges: false,
          undo: () => void 0,
        };

      const dataBeforeUpdate = entity.getData();

      const undoData = pick(dataBeforeUpdate, changedKeys);

      store.events.emit("willUpdate", entity, input, source);

      runInAction(() => {
        changedKeys.forEach((keyToUpdate) => {
          const value = input[keyToUpdate];
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          (entity as D)[keyToUpdate] = value!;
        });

        touchUpdatedAt();
      });

      store.events.emit("updated", entity, dataBeforeUpdate, source);

      return {
        hadChanges: true,
        undo(source = "user") {
          entityMethods.update(undoData, source);
        },
      };
    },
  };

  const entity: Entity<D, V> = extendObservable(
    observableDataAndView,
    entityMethods,
    {
      getData: false,
      getId: false,
      getIdPropName: false,
      getUpdatedAt: false,
      definition: false,
      waitForSync: false,
      remove: action,
      update: action,
      db: false,
    }
  );

  return entity;
}
