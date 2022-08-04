import { Knex } from "knex";
import { uniqBy } from "lodash";
import { SyncRequestContext } from "../context";
import { QueryBuilder } from "../query/types";
import {
  PermissionJoinInfo,
  PermissionRule,
  PermissionRuleItem,
} from "./PermissionRule";
import { ValueRule } from "./ValueRule";

type ApplyWhereCallback = (
  qb: QueryBuilder,
  rulePart: PermissionRuleItem
) => void;

export class PermissionQueryBuilder {
  protected qb: Knex.QueryBuilder;
  constructor(public rule: PermissionRule) {
    this.qb = this.db.queryBuilder().table(this.entity.name);
  }

  get db() {
    return this.rule.db;
  }

  get schema() {
    return this.rule.schema;
  }

  get entity() {
    return this.rule.entity;
  }

  get entityName() {
    return this.entity.name;
  }

  protected getFieldSelector(field: string) {
    return `${this.entity.name}.${field}`;
  }

  get joins() {
    const joins: PermissionJoinInfo[] = [];
    for (const { rule } of this.rule) {
      const joinInfo = rule?.joinInfo;

      if (!joinInfo) continue;

      joins.push(joinInfo);
    }

    return uniqBy(joins, (join) => JSON.stringify(join));
  }

  applyWhere(callback: ApplyWhereCallback, qb = this.qb) {
    this.qb = applyQueryBuilder(qb, this.rule, callback);

    return this;
  }

  addJoins() {
    const joins = this.joins;

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

  selectId() {
    this.qb = this.qb.select(this.getFieldSelector(this.entity.idField));

    return this;
  }

  selectAllData() {
    this.qb = this.qb.select(
      this.entity.allAttributeNames.map((attributeName) => {
        return this.getFieldSelector(attributeName);
      })
    );

    return this;
  }

  applyRules(context: SyncRequestContext, qb = this.qb) {
    this.applyWhere((qb, { value }) => {
      if (!value) return;

      value.applyToQuery(qb, context);
    }, qb);

    return this;
  }

  transacting(trx: Knex.Transaction) {
    this.qb = this.qb.transacting(trx);
    return this;
  }

  build(context: SyncRequestContext) {
    this.addJoins();
    return this.qb;
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
