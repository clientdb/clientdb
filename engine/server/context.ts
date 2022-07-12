import { DbSchema } from "../schema/schema";
import { Knex, knex } from "knex";

export interface SyncRequestContext {
  userId: string | null;
  lastSyncId: number | null;
  schema: DbSchema;
  db: Knex;
}
