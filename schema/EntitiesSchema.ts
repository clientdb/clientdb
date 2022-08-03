import { EntitiesSchemaInput } from "./schema";
import { EntitySchema } from "./EntitySchema";
import { memoize } from "lodash";

export class EntitiesSchema {
  constructor(private input: EntitiesSchemaInput) {
    this.getEntity = memoize(this.getEntity);
  }

  getEntity(entityName: string) {
    const entityInput = this.input.entities.find((e) => e.name === entityName);

    if (!entityInput) return null;

    return new EntitySchema(entityInput, this);
  }

  assertEntity(entityName: string) {
    const entity = this.getEntity(entityName);

    if (!entity) {
      throw new Error(`Entity ${entityName} not found`);
    }

    return entity;
  }
}
