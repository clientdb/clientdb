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
) => void;

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

  applyRuleJoins(rule: PermissionRule) {
    const joins = this.getRuleJoins(rule);

    for (const join of joins) {
      this.qb = this.qb.leftJoin(
        `${join.table} as ${join.selector}`,
        `${join.on.left}`,
        "=",
        `${join.on.right}`
      );
    }

    return this;
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
  const { dataRules, relationRules, $or, $and } = rule;

  if (rule.isRoot) {
    callback(qb, { rule });
  }

  for (const dataRule of dataRules) {
    callback(qb, { value: dataRule });
  }

  for (const relationRule of relationRules) {
    callback(qb, { rule: relationRule });

    qb = applyQueryBuilder(qb, relationRule, callback);
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
