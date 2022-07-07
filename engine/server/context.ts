import { DbSchema } from "../schema/schema";

export interface SyncRequestContext {
  userId: string | null;
  schema: DbSchema;
  connector: any;
}
