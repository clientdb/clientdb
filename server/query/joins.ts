import { QueryBuilder } from "./types";

export interface JoinInfo {
  table: string;
  from: string;
  fromColumn: string;
  toColumn: string;
  alias: string;
}

export function applyQueryJoins(query: QueryBuilder, joins: JoinInfo[]) {
  for (const join of joins) {
    const { toColumn, fromColumn, alias, from, table } = join;
    query = query.leftJoin(
      `${join.table} as ${alias}`,
      `${from}.${fromColumn}`,
      "=",
      `${alias}.${toColumn}`
    );
  }

  return query;
}
