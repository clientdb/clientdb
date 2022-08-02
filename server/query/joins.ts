import { QueryBuilder } from "./types";

export interface JoinInfo {
  to: string;
  from: string;
  fromColumn: string;
  toColumn: string;
  alias: string;
}

export function applyQueryJoins(query: QueryBuilder, joins: JoinInfo[]) {
  for (const join of joins) {
    const { toColumn, fromColumn, alias, from, to } = join;
    query = query.leftJoin(
      `${join.to} as ${alias}`,
      `${from}.${fromColumn}`,
      "=",
      `${alias}.${toColumn}`
    );
  }

  return query;
}
