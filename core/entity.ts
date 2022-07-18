import { pick } from "lodash";
import { action, extendObservable, makeAutoObservable, toJS } from "mobx";
import { EntityClient } from "./client";

import { ClientDb } from "./db";
import { EntityDefinition, EntityViewLinker } from "./definition";
import { EntityUpdatedEvent } from "./events";
import { EntityStore } from "./store";
import { assert } from "./utils/assert";
import { CleanupObject, createCleanupObject } from "./utils/cleanup";
import { typedKeys } from "./utils/object";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type EntityMethods<Data, View> = {
  update(data: Partial<Data>): EntityUpdatedEvent<Data, View>;
  getData(): Data;
  getId(): string;
  getIdPropName(): string;
  remove(): void;
  isRemoved(): boolean;
  definition: EntityDefinition<Data, View>;
  db: ClientDb;
  store: EntityStore<Data, View>;
  client: EntityClient<Data, View>;
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
  client: EntityClient<D, V>;
}

function assertDataMatchDefinition<D>(
  data: D,
  definition: EntityDefinition<D, any>
) {
  const rawDataKeys = new Set(typedKeys(data));

  for (const requiredKey of definition.config.fields) {
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
  client,
}: CreateEntityInput<D, V>): Entity<D, V> {
  const { store } = client;
  const { definition, db } = store;

  const { config } = definition;
  const dataWithDefaults = fillDataDefaults(data, store);

  assertDataMatchDefinition(dataWithDefaults, definition);

  const initialKey = data[config.idField!];

  const observableData = makeAutoObservable<D & object>(
    dataWithDefaults as D & object,
    config.customObservableAnnotations,
    {
      name: `${definition.config.name}-${initialKey}`,
    }
  );

  const cleanupObject = createCleanupObject();

  const viewLinker: EntityViewLinker<D, V> = {
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
    store: store,
    client,
    cleanup: cleanupObject,
    remove() {
      client.remove(entityMethods.getId());
    },
    isRemoved() {
      return !store.findById(entityMethods.getId());
    },
    getId() {
      return `${entity[config.idField!]}`;
    },
    getIdPropName() {
      return config.idField as string;
    },
    getData() {
      const rawObject = toJS(entity);
      return pick(rawObject, definition.config.fields);
    },
    update(input) {
      return client.update(entityMethods.getId(), input);
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
      store: false,
      client: false,
      cleanup: false,
      update: action,
      db: false,
    }
  );

  return entity;
}
