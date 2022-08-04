import { SyncRequestContext } from "../context";
import { PermissionQueryBuilder } from "./PermissionQueryBuilder";
import { PermissionRule } from "./PermissionRule";

export class AccessQueryBuilder extends PermissionQueryBuilder {
  constructor(public rule: PermissionRule) {
    super(rule);
    this.qb = this.db.queryBuilder().table(this.entity.name);
  }

  byId(id: string) {
    this.qb = this.qb.where(this.rule.idSelector, "=", id).limit(1);
    return this;
  }

  narrowToUser(userId: string) {
    this.applyWhere((qb, { rule, value }) => {
      if (value?.isPointingToUser) {
        qb.where(value.selector, "=", userId);
      }
    });

    return this;
  }

  build(context: SyncRequestContext) {
    super.build(context);
    return this.qb.groupBy(this.getFieldSelector(this.entity.idField));
  }
}
