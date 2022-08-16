import { Queryable, sql } from "@databases/pg";

export type PgTypesLookup = Map<number, string>;

export async function getDbTypes(db: Queryable): Promise<PgTypesLookup> {
  const rows = await db.query(sql`SELECT * FROM pg_type`);

  const lookup = new Map<number, string>();

  for (const row of rows) {
    if (lookup.has(row.oid)) continue;

    lookup.set(row.oid, row.typname);
  }

  return lookup;
}
