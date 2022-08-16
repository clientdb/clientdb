import { Knex } from "knex";
import { uniqBy } from "lodash";
import { SyncRequestContext } from "../context";
import { QueryBuilder } from "../query/types";
import {
  PermissionJoinInfo,
  PermissionRule,
  PermissionRuleItem,
} from "./PermissionRule";

type ApplyWhereCallback = (
  qb: QueryBuilder,
  rulePart: PermissionRuleItem
) => void | QueryBuilder | false;

export class PermissionQueryBuilder {
  protected qb: Knex.QueryBuilder;
  constructor(public context: SyncRequestContext) {
    this.qb = this.db.queryBuilder();
  }

  get query() {
    return this.qb;
  }

  reset() {
    this.qb = this.db.queryBuilder();
    return this;
  }

  getRaw(input: any) {
    return this.db.raw("?", [input]);
  }

  get db() {
    return this.context.db;
  }

  get schema() {
    return this.context.schema;
  }

  private getRuleJoins(ruleToAdd: PermissionRule) {
    const joins: PermissionJoinInfo[] = [];
    for (const { rule } of ruleToAdd) {
      const joinInfo = rule?.joinInfo;

      if (!joinInfo) continue;

      joins.push(joinInfo);
    }

    return uniqBy(joins, (join) => JSON.stringify(join));
  }

  applyRuleJoins(rule: PermissionRule, qb = this.qb) {
    const joins = this.getRuleJoins(rule);

    for (const join of joins) {
      qb = qb.leftJoin(
        `${join.table} as ${join.selector}`,
        `${join.on.left}`,
        "=",
        `${join.on.right}`
      );
    }

    return qb;
  }

  limit(count: number) {
    this.qb = this.qb.limit(count);
    return this;
  }

  applyRule(rule: PermissionRule, callback: ApplyWhereCallback, qb = this.qb) {
    this.qb = applyQueryBuilder(qb, rule, callback);

    return this;
  }

  selectRuleEntityId(rule: PermissionRule) {
    this.qb = this.qb.select(rule.idSelector);

    return this;
  }

  selectRuleData(rule: PermissionRule) {
    this.qb = this.qb.select(
      rule.entity.allAttributeNames.map((attributeName) => {
        return `${rule.selector}.${attributeName}`;
      })
    );

    return this;
  }

  applyRuleFrom(rule: PermissionRule) {
    this.qb = this.qb.from(rule.entity.name);

    return this;
  }

  transacting(trx: Knex.Transaction) {
    this.qb = this.qb.transacting(trx);
    return this;
  }
}

function applyQueryBuilder(
  qb: QueryBuilder,
  rule: PermissionRule,
  callback: ApplyWhereCallback
) {
  const { dataRules, relationRules, $or, $and, db } = rule;

  if (rule.isRoot) {
    callback(qb, { rule });
  }

  for (const dataRule of dataRules) {
    callback(qb, { value: dataRule });
  }

  for (const relationRule of relationRules) {
    const joinInfo = relationRule.joinInfo!;

    qb = qb.whereExists((qb) => {
      qb = qb
        .select(qb.client.raw("?", [1]))
        .from(db.ref(`${relationRule.entity.name} as ${relationRule.selector}`))
        .where(db.ref(joinInfo.on.left), "=", db.ref(joinInfo.on.right));

      const rawQuery = qb.toString();

      qb = qb.andWhere((qb) => {
        const result = callback(qb, { rule: relationRule });

        if (result === false) {
          // return;
        }

        qb = applyQueryBuilder(qb, relationRule, callback);
      });

      const rawQueryAfterApplying = qb.toString();

      if (rawQuery === rawQueryAfterApplying) {
        qb = clearQueryBuilder(qb);
        qb.from(null as any);
      }

      // console.log(rawQuery, "\n", rawQueryAfterApplying);
    });

    // qb = applyQueryBuilder(qb, relationRule, callback);
  }

  qb = qb.andWhere((qb) => {
    for (const orRule of $or) {
      qb = qb.orWhere((qb) => {
        qb = applyQueryBuilder(qb, orRule, callback);
      });
    }
  });

  for (const andRule of $and) {
    qb = qb.andWhere((qb) => {
      qb = applyQueryBuilder(qb, andRule, callback);
    });
  }

  return qb;
}

type ClearStatements =
  | "with"
  // | "select"
  // | "columns"
  | "hintComments"
  | "where"
  | "union"
  | "join"
  | "group"
  | "order"
  | "having"
  | "limit"
  | "offset"
  | "counter"
  | "counters";

const clearStatementsMap: Record<ClearStatements, true> = {
  with: true,
  // select: true,
  // columns: true,
  hintComments: true,
  where: true,
  union: true,
  join: true,
  group: true,
  order: true,
  having: true,
  limit: true,
  offset: true,
  counter: true,
  counters: true,
};

function clearQueryBuilder(qb: QueryBuilder) {
  const statementsToClear = Object.keys(
    clearStatementsMap
  ) as ClearStatements[];

  for (const statementToClear of statementsToClear) {
    qb = qb.clear(statementToClear);
  }

  return qb;
}
