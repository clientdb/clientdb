import { EntitiesSchemaInput } from "./schema";
import { EntitySchema } from "./EntitySchema";
import { memoize } from "lodash";
import { Knex } from "knex";

interface EntitiesSchemaOptions {
  db: Knex;
  userTable: string;
}

export class EntitiesSchema {
  constructor(
    private input: EntitiesSchemaInput,
    public readonly options: EntitiesSchemaOptions
  ) {
    this.getEntity = memoize(this.getEntity);
  }

  get db() {
    return this.options.db;
  }

  get userEntity() {
    return this.assertEntity(this.userTableName);
  }

  get userTableName() {
    return this.options.userTable;
  }

  getEntity(entityName: string) {
    const entityInput = this.input.entities.find((e) => e.name === entityName);

    if (!entityInput) return null;

    return new EntitySchema(entityInput, this);
  }

  get entities() {
    return this.input.entities.map((entity) => {
      return this.assertEntity(entity.name);
    });
  }

  assertEntity(entityName: string) {
    const entity = this.getEntity(entityName);

    if (!entity) {
      throw new Error(`Entity ${entityName} not found`);
    }

    return entity;
  }
}
