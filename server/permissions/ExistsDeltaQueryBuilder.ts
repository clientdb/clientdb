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
  constructor(
    public rule: PermissionRule,
    public context: SyncRequestContext,
    public changed: EntityPointer
  ) {
    super(rule, context);
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
    return this.rule.filter({
      branches: (branchRule) => {
        return !this.getIsRuleImpacted(branchRule);
      },
    });
  }

  applyRuleConnectingWithUser(rule: PermissionRule, qb = this.qb) {
    return this.applyRule(
      rule,
      (qb, { value }) => {
        if (value?.isPointingToUser) {
          qb.where(
            value.selector,
            "=",
            this.db.ref(this.selectors.allowedUserId)
          );
        } else {
          value?.applyToQuery(qb, this.context);
        }
      },
      qb
    );
  }

  private applyImpactedWhere() {
    this.narrowToEntity(this.changed);

    const { alreadyHadAccessRule, rule } = this;

    if (this.isSelfImpacting) {
      this.applyRuleConnectingWithUser(rule);
      return this;
    }

    this.qb = this.qb.andWhereNot((qb) => {
      this.applyRuleConnectingWithUser(alreadyHadAccessRule, qb);
    });

    this.applyRuleConnectingWithUser(rule);

    return this;
  }

  prepareForType(type: DeltaType) {
    super.prepareForType(type);

    this.applyImpactedWhere();

    return this;
  }
}
