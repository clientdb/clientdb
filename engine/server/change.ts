import { SyncRequestContext } from "./context";

export type EntityRemoveChange = {
  type: "remove";
  entity: string;
  id: string;
};

export type EntityUpdateChange = {
  type: "update";
  entity: string;
  id: string;
  data: object;
};

export type EntityCreateChange = {
  type: "create";
  entity: string;
  data: object;
};

export type EntityChange =
  | EntityRemoveChange
  | EntityUpdateChange
  | EntityCreateChange;

export function getEntityChangeSchema(
  change: EntityChange,
  context: SyncRequestContext
) {
  const { entity } = change;

  const schema = context.schema.entities.find((e) => e.name === entity);

  if (!schema) {
    throw new Error(`No schema found for entity ${entity}`);
  }

  return schema;
}
