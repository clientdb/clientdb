import { ClientDb } from "./db";
import { Entity } from "./entity";
import { ClientDBTransaction } from "./transaction";
import { Changes } from "./utils/changes";
import { EventsEmmiter } from "./utils/eventManager";

export interface EntityCreatedEvent<Data, View> {
  type: "created";
  entity: Entity<Data, View>;
  db: ClientDb;
  rollback: () => void;
}
export interface EntityUpdatedEvent<Data, View> {
  type: "updated";
  entity: Entity<Data, View>;
  changes: Changes<Data>;
  db: ClientDb;
  rollback: () => void;
}

export interface EntityRemovedEvent<Data, View> {
  type: "removed";
  entity: Entity<Data, View>;
  db: ClientDb;
  rollback: () => void;
}

export type EntityChangeEvent<Data, View> =
  | EntityCreatedEvent<Data, View>
  | EntityUpdatedEvent<Data, View>
  | EntityRemovedEvent<Data, View>;

export type EntityStoreEvents<Data, View> = {
  created: [EntityCreatedEvent<Data, View>];
  updated: [EntityUpdatedEvent<Data, View>];
  removed: [EntityRemovedEvent<Data, View>];
};

export type EntityStoreEventsEmmiter<Data, View> = EventsEmmiter<
  EntityStoreEvents<Data, View>
>;

export interface TransactionEvent {
  type: "transaction";
  transaction: ClientDBTransaction;
}

export type ClientDbEvents = {
  transaction: [TransactionEvent];
};

export type ClientDbEventsEmmiter = EventsEmmiter<ClientDbEvents>;
