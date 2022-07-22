import { Knex } from "knex";
import { DbSchemaModel } from "../schema/model";
import { DbSchema } from "../schema/schema";
import {
  EntitySchemaData,
  EntitySchemaInput,
  SchemaPermissions,
} from "../schema/types";
import { EntityChange } from "./change";
import { SyncRequestContext } from "./context";
import { SyncHandler } from "./handler";

interface SyncAdminInput<Schema> {
  db: Knex;
  handler: SyncHandler;
  schema: DbSchemaModel;
  permissions: SchemaPermissions<Schema>;
}

interface AdminCreateContextInput {
  userId?: string | null;
  lastSyncId?: number | null;
}

export function createSyncAdmin<Schema>({
  db,
  handler,
  schema,
  permissions,
}: SyncAdminInput<Schema>) {
  function createContext(input?: AdminCreateContextInput): SyncRequestContext {
    return {
      userId: input?.userId ?? null,
      lastSyncId: input?.lastSyncId ?? null,
      db,
      schema,
      permissions,
    };
  }

  async function getInit(input?: AdminCreateContextInput) {
    const context = createContext(input);
    return handler.getInit(context);
  }

  async function getSync(input?: AdminCreateContextInput) {
    const context = createContext(input);
    return handler.getSync(context);
  }

  async function mutate<T extends keyof Schema>(
    input: EntityChange<T, EntitySchemaData<Schema[T]>>,
    contextInput?: AdminCreateContextInput
  ) {
    const context = createContext(contextInput);
    return handler.mutate(context, input);
  }

  async function create<T extends keyof Schema>(
    entity: T,
    input: EntitySchemaInput<Schema[T]>,
    contextInput?: AdminCreateContextInput
  ) {
    mutate<T>({ type: "create", entity, data: input }, contextInput);
  }

  return {
    getInit,
    getSync,
    mutate,
    create,
  };
}

export type SyncAdmin = ReturnType<typeof createSyncAdmin>;
