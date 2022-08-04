import { SyncRequestContext } from "../context";
import { EntityPointer } from "../entity/pointer";
import { DeltaType } from "./delta";
import { DeltaQueryBuilder } from "./DeltaQueryBuilder";
import { PermissionRuleInput } from "./input";
import { PermissionRule } from "./PermissionRule";

/**
 * Creates query of impact of one entity existance on one other entity rule
 * eg. compute who lost access to team as a result of removing some team membership
 */
export class ExistsDeltaQueryBuilder extends DeltaQueryBuilder {
  constructor(public rule: PermissionRule, public changed: EntityPointer) {
    super(rule);
  }

  get raw(): PermissionRuleInput<any> {
    return this.rule.raw;
  }

  get changedEntity() {
    return this.schema.assertEntity(this.changed.entity);
  }

  get changedEntityName() {
    return this.changedEntity.name;
  }

  get isSelfImpacting() {
    return this.changed.entity === this.rule.entity.name;
  }

  private getIsRuleImpacted(ruleToCheck: PermissionRule) {
    const { changedEntityName } = this;
    for (const { rule, value } of ruleToCheck) {
      if (value?.entity.name === changedEntityName) return true;
      if (value?.referencedEntity?.name === changedEntityName) return true;

      if (rule?.entity.name === changedEntityName) {
        return true;
      }

      let parent = rule?.parentRule;

      while (parent) {
        if (parent.entity.name === changedEntityName) return true;
        parent = parent.parentRule;
      }
    }

    return false;
  }

  get alreadyHadAccessRule() {
    const rule = this.rule.filter({
      branches: (branchRule) => {
        return !this.getIsRuleImpacted(branchRule);
      },
    });

    return new ExistsDeltaQueryBuilder(rule, this.changed);
  }

  applyRules(context: SyncRequestContext<any>, qb = this.qb) {
    return this.applyWhere((qb, { value }) => {
      if (value?.isPointingToUser) {
        qb.where(
          value.selector,
          "=",
          this.db.ref(this.selectors.allowedUserId)
        );
      } else {
        value?.applyToQuery(qb, context);
      }
    }, qb);
  }

  private applyImpactedWhere(context: SyncRequestContext) {
    this.narrowToEntity(this.changed);

    const { alreadyHadAccessRule } = this;

    if (this.isSelfImpacting) {
      this.applyRules(context);
      return this;
    }

    this.qb = this.qb.andWhereNot((qb) => {
      alreadyHadAccessRule.applyRules(context, qb);
    });

    this.applyRules(context);

    return this;
  }

  buildForType(type: DeltaType, context: SyncRequestContext) {
    super.buildForType(type, context);

    this.applyImpactedWhere(context);

    return this.qb;
  }
}
