import { SyncRequestContext } from "../context";
import { UnauthorizedError } from "../error";
import { Transaction } from "../query/types";
import { PermissionQueryBuilder } from "./PermissionQueryBuilder";
import { PermissionRule } from "./PermissionRule";

export class AccessQueryBuilder<T = any> extends PermissionQueryBuilder {
  constructor(public rule: PermissionRule, public context: SyncRequestContext) {
    super(context);
    this.applyRuleFrom(rule);
  }

  get userId() {
    return this.context.userId;
  }

  reset() {
    super.reset();
    this.applyRuleFrom(this.rule);
    return this;
  }

  applyId(id: string) {
    this.qb = this.qb.where(this.rule.idSelector, "=", id);
    return this;
  }

  applyRulesUser() {
    this.applyRule(this.rule, (qb, { rule, value }) => {
      if (!value) return;
      if (value.isPointingToUser) {
        qb.where(value.selector, "=", this.userId);
        return;
      }

      value.applyToQuery(qb, this.context);
    });

    return this;
  }

  selectId() {
    super.selectRuleEntityId(this.rule);
    return this;
  }

  selectData() {
    super.selectRuleData(this.rule);
    return this;
  }

  async canUserAccess(tr: Transaction, id: string) {
    const results = await this.reset()
      .applyRulesUser()
      .applyId(id)
      .selectId()
      .limit(1)
      .qb.transacting(tr);

    return results.length > 0;
  }

  getOneForUserQuery(id: string) {
    return this.reset().applyRulesUser().applyId(id).selectData().limit(1).qb;
  }

  private getOneWithoutPermission(id: string) {
    return this.reset().applyId(id).selectData().limit(1).qb;
  }

  async getAll(tr: Transaction): Promise<T[]> {
    return await this.reset().applyRulesUser().selectData().qb.transacting(tr);
  }

  async getOne(tr: Transaction, id: string): Promise<T | null> {
    const results = await this.getOneForUserQuery(id).transacting(tr);

    return results[0] ?? null;
  }

  async getOneOrThrowIfNotAllowed(
    tr: Transaction,
    id: string
  ): Promise<T | null> {
    const oneForUser = this.getOneForUserQuery(id).transacting(tr);
    const oneIfExists = this.getOneWithoutPermission(id).transacting(tr);

    const allowedAndExistingQuery = this.db
      .queryBuilder()
      .unionAll(oneForUser, true)
      .unionAll(oneIfExists, true);

    const results = await allowedAndExistingQuery;

    if (results.length === 0) {
      return null;
    }

    if (results.length === 1) {
      throw new UnauthorizedError(
        `Not allowed to access ${this.rule.entity.name}`
      );
    }

    return results[0] as T;
  }
}
