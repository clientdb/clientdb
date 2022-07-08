import { isEqual, pick } from "lodash";
import {
  action,
  extendObservable,
  makeAutoObservable,
  runInAction,
  toJS,
} from "mobx";

import { ClientDb } from "./db";
import { EntityDefinition, EntityViewLinker } from "./definition";
import { EntityStore, EntityUpdateResult } from "./store";
import { assert } from "./utils/assert";
import { CleanupObject, createCleanupObject } from "./utils/cleanup";
import { typedKeys } from "./utils/object";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type EntityMethods<Data, View> = {
  update(data: Partial<Data>): EntityUpdateResult;
  getData(): Data;
  getId(): string;
  getIdPropName(): string;
  remove(): void;
  isRemoved(): boolean;
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

interface CreateEntityInput<D, V> {
  data: Partial<D>;
  store: EntityStore<D, V>;
}

function assertDataMatchDefinition<D>(
  data: D,
  definition: EntityDefinition<D, any>
) {
  const rawDataKeys = new Set(typedKeys(data));

  for (const requiredKey of definition.config.keys) {
    assert(
      rawDataKeys.has(requiredKey),
      `Required field "${
        requiredKey as string
      }" is missing when creating new entity ${definition.config.name}`
    );

    rawDataKeys.delete(requiredKey);
  }

  if (rawDataKeys.size > 0) {
    const missingFields = Array.from(rawDataKeys).join(", ");
    throw new Error(
      `Unknown fields "${missingFields}" found when creating new entity "${definition.config.name}"`
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

  assertDataMatchDefinition(dataWithDefaults, definition);

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
      return entity.update(data);
    },
    cleanup: cleanupObject,
  };

  const view = config.getView?.(observableData, viewLinker) ?? ({} as V);

  // Note: we dont want to add view as {...data, ...connections}. Connections might have getters so it would simply unwrap them.
  const observableDataAndView = extendObservable(observableData, view);

  const entityMethods: EntityMethods<D, V> = {
    definition,
    db: db,
    cleanup: cleanupObject,
    remove() {
      store.removeById(entityMethods.getId());
    },
    isRemoved() {
      return !store.findById(entityMethods.getId());
    },
    getId() {
      return `${entity[config.idField]}`;
    },
    getIdPropName() {
      return config.idField as string;
    },
    getData() {
      const rawObject = toJS(entity);
      return pick(rawObject, definition.config.keys);
    },
    update(input): EntityUpdateResult {
      return store.updateById(entityMethods.getId(), input);
    },
  };

  const entity: Entity<D, V> = extendObservable(
    observableDataAndView,
    entityMethods,
    {
      getData: false,
      getId: false,
      getIdPropName: false,
      definition: false,
      remove: action,
      update: action,
      db: false,
    }
  );

  return entity;
}
