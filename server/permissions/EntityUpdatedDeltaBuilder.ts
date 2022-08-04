import { SyncRequestContext } from "../context";
import { EntityChangesPointer } from "../entity/pointer";
import { Transaction } from "../query/types";
import { isNotNullish } from "../utils/nullish";

import { pickAfterFromChanges, pickCurrentFromChanges } from "../utils/changes";
import { DeltaQueryBuilder } from "./DeltaQueryBuilder";
import { PermissionRule } from "./PermissionRule";
import { ValueRule } from "./ValueRule";

export interface SingleUpdateDeltaQueryBuilderOptions<T> {
  changed: EntityChangesPointer<T>;
}

/**
 * Creates query of impact of one entity existance on one other entity rule
 * eg. compute who lost access to team as a result of removing some team membership
 */
class UpdateLostAccessDeltaQueryBuilder<T> extends DeltaQueryBuilder {
  constructor(public rule: PermissionRule, context: SyncRequestContext) {
    super(rule, context);
  }

  getImpactedRule(changed: EntityChangesPointer<T>) {
    return this.rule.filter({
      branches: (rule) => {
        return getIsRuleImpactedByChange(rule, changed);
      },
    });
  }

  getNotImpactedRule(changed: EntityChangesPointer<T>) {
    return this.rule.filter({
      branches: (rule) => {
        return !getIsRuleImpactedByChange(rule, changed);
      },
    });
  }

  /**
   * Who lost access?
   * people who:
   * - had permission only because of part that is impacted (aka. did not have it with non-impacted part)
   * - do not have it anymore with new values
   */
  private applyLostAccessWhere(changed: EntityChangesPointer<T>) {
    const id = changed.id;
    const current = pickCurrentFromChanges(changed.changes);

    const impactedRule = this.getImpactedRule(changed);

    // Had access thanks to this rule
    this.applyRule(impactedRule, (qb, { rule, value }) => {
      // If rule is impacted, narrow it down to id of changed entity
      if (rule) {
        if (getDoesRuleOwnChangedFields(rule, changed)) {
          qb.where(rule.idSelector, "=", id);
        }
        return;
      }

      if (!value) return;

      // Value is not impacted
      if (!getIsValueImpactedByChange(value, changed)) {
        if (value.isPointingToUser) {
          return qb.where(value.selector, "=", this.selectors.allowedUserIdRef);
        }

        return value.applyToQuery(qb, this.context);
      }

      // Value is impacted

      // Impacted value targets user -
      if (value.isPointingToUser) {
        return qb.where(
          this.selectors.allowedUserIdRef,
          "=",
          current[value.field as keyof T] as any
        );
      }

      // It is static value and we check for current state - we can apply normally

      value.applyToQuery(qb, this.context);
    });

    const notImpactedRule = this.getNotImpactedRule(changed);

    this.qb = this.qb.andWhereNot((qb) => {
      this.applyDeltaRule(notImpactedRule, qb);
    });
  }

  private applyDeltaRule(rule: PermissionRule, qb = this.qb) {
    this.applyRule(
      rule,
      (qb, { value }) => {
        if (!value) return;

        if (value.isPointingToUser) {
          return qb.where(value.selector, "=", this.selectors.allowedUserIdRef);
        }

        value.applyToQuery(qb, this.context);
      },
      qb
    );
  }

  applyForChange(changed: EntityChangesPointer<T>) {
    super.prepareForType("delete");
    this.applyLostAccessWhere(changed);

    return this;
  }
}

class UpdateGainedAccessDeltaQueryBuilder<T> extends DeltaQueryBuilder {
  constructor(public rule: PermissionRule, context: SyncRequestContext) {
    super(rule, context);
  }

  getImpactedRule(changed: EntityChangesPointer<T>) {
    return this.rule.filter({
      branches: (rule) => {
        return getIsRuleImpactedByChange(rule, changed);
      },
    });
  }

  getNotImpactedRule(changed: EntityChangesPointer<T>) {
    return this.rule.filter({
      branches: (rule) => {
        return !getIsRuleImpactedByChange(rule, changed);
      },
    });
  }

  /**
   * Who gained access?
   * people who:
   * - did not have permission for full rule before
   * - do have permission for change impacted rule
   */
  private applyGainedAccessWhere(changed: EntityChangesPointer<T>) {
    const id = changed.id;
    const after = pickAfterFromChanges(changed.changes);

    const impactedRule = this.getImpactedRule(changed);

    // People who did not have any access before
    this.qb = this.qb.andWhereNot((qb) => {
      this.applyDeltaRule(this.rule, qb);
    });

    // Had access thanks to this rule
    this.applyRule(impactedRule, (qb, { rule, value }) => {
      // If rule is impacted, narrow it down to id of changed entity
      if (rule) {
        if (getDoesRuleOwnChangedFields(rule, changed)) {
          qb.where(rule.idSelector, "=", id);
        }
        return;
      }

      if (!value) return;

      // Value is not impacted
      if (!getIsValueImpactedByChange(value, changed)) {
        if (value.isPointingToUser) {
          return qb.where(value.selector, "=", this.selectors.allowedUserIdRef);
        }

        return value.applyToQuery(qb, this.context);
      }

      // Value is impacted
      const afterValue = after[value.field as keyof T] as any;

      // Impacted value targets user -
      if (value.isPointingToUser) {
        return qb.where(this.selectors.allowedUserIdRef, "=", afterValue);
      }

      // It is static value - we pretend entity already updated and do 'hardcode' comparsion
      // TODO: other than $eq
      qb.where(
        this.getRaw(afterValue),
        "=",
        this.getRaw(value.valueConfig.$eq)
      );
    });
  }

  private applyDeltaRule(rule: PermissionRule, qb = this.qb) {
    this.applyRule(
      rule,
      (qb, { value }) => {
        if (!value) return;

        if (value.isPointingToUser) {
          return qb.where(value.selector, "=", this.selectors.allowedUserIdRef);
        }

        value.applyToQuery(qb, this.context);
      },
      qb
    );
  }

  applyForChange(changed: EntityChangesPointer<T>) {
    super.prepareForType("delete");
    this.applyGainedAccessWhere(changed);

    return this;
  }
}

export class LostOrGainedAccessUpdateDeltaBuilder {
  constructor(public context: SyncRequestContext) {
    this.context = context;
  }

  get db() {
    return this.context.db;
  }

  private buildQueryForRule(
    rule: PermissionRule,
    changed: EntityChangesPointer<any>
  ) {
    const lostAccess = new UpdateLostAccessDeltaQueryBuilder(
      rule,
      this.context
    ).applyForChange(changed).query;
    const gainedAccess = new UpdateGainedAccessDeltaQueryBuilder(
      rule,
      this.context
    ).applyForChange(changed).query;

    const accessChangeForRule = this.db
      .queryBuilder()
      .unionAll(lostAccess, true)
      .unionAll(gainedAccess, true);

    return accessChangeForRule;
  }

  getImpactedRules(changed: EntityChangesPointer<any>) {
    return this.context.permissions.entities
      .map((entity) => {
        return this.context.permissions.getPermissionRule(entity, "read");
      })
      .filter(isNotNullish)
      .filter((rule) => {
        return getIsRuleImpactedByChange(rule, changed);
      });
  }

  buildForChanged(changed: EntityChangesPointer<any>) {
    const queries = this.getImpactedRules(changed).map((rule) => {
      const query = this.buildQueryForRule(rule, changed);

      console.log(`delta for ${rule.entity.name}`, query.toString());
      return query;
    });

    if (!queries.length) {
      return null;
    }

    const qb = this.db.queryBuilder();

    const allDeltaQuery = queries.reduce((qb, nextDeltaQuery) => {
      return qb.unionAll(nextDeltaQuery, true);
    }, qb);

    return allDeltaQuery;
  }

  async insert(tr: Transaction, changed: EntityChangesPointer<any>) {
    let query = this.buildForChanged(changed)?.transacting(tr);

    if (!query) {
      return;
    }

    console.log("del", query.toString());

    const deltaResults = await query;

    console.log("delta update results", changed, deltaResults);

    if (!deltaResults.length) {
      return;
    }

    await tr.table("sync").insert(deltaResults);
  }
}

function getIsValueImpactedByChange<T>(
  value: ValueRule<T>,
  changed: EntityChangesPointer<T>
) {
  const changedFields = Object.keys(changed.changes);
  if (
    value.entity.name === changed.entity &&
    changedFields.includes(value.field)
  ) {
    return true;
  }

  return false;
}

function getIsRuleImpactedByChange<T>(
  ruleToCheck: PermissionRule,
  changed: EntityChangesPointer<T>
) {
  for (const { value } of ruleToCheck) {
    if (value && getIsValueImpactedByChange(value, changed)) return true;
  }

  return false;
}

function getDoesRuleOwnChangedFields<T>(
  ruleToCheck: PermissionRule,
  changed: EntityChangesPointer<T>
) {
  const { entity, changes } = changed;
  const changedFields = Object.keys(changes);
  for (const value of ruleToCheck.dataRules) {
    if (value.entity.name !== entity) continue;

    if (!changedFields.includes(value.field)) continue;

    return true;
  }

  return false;
}
