import { SyncRequestContext } from "../context";
import { EntityChangesPointer } from "../entity/pointer";
import { Transaction } from "../query/types";
import { isNotNullish } from "../utils/nullish";
import { DeltaType } from "./delta";

import { DeltaQueryBuilder } from "./DeltaQueryBuilder";
import { PermissionRuleInput } from "./input";
import { PermissionRule } from "./PermissionRule";
import { ValueRule } from "./ValueRule";
import { pickAfterFromChanges, pickBeforeFromChanges } from "../utils/changes";

export interface SingleUpdateDeltaQueryBuilderOptions<T> {
  changed: EntityChangesPointer<T>;
}

/**
 * Creates query of impact of one entity existance on one other entity rule
 * eg. compute who lost access to team as a result of removing some team membership
 */
class SingleUpdateDeltaQueryBuilder<T> extends DeltaQueryBuilder {
  constructor(public rule: PermissionRule, changed: EntityChangesPointer<T>) {
    super(rule);

    this.changed = changed;
  }

  readonly changed: EntityChangesPointer<T>;

  applyWhereForState(
    context: SyncRequestContext<any>,
    state: "before" | "after",
    qb = this.qb
  ) {
    const currentData = pickBeforeFromChanges(this.changed.changes);
    const expectedData =
      state === "after"
        ? pickAfterFromChanges(this.changed.changes)
        : currentData;

    const changedKeys = Object.keys(currentData);

    const allowedUserRef = this.db.ref(this.selectors.allowedUserId);

    return this.applyWhere((qb, { value }) => {
      if (!value) return;

      if (!changedKeys.includes(value.field)) {
        value.applyToQuery(qb, context);
        return;
      }

      const expectedValue = this.db.raw("?", [
        expectedData[value.field as keyof T] as any,
      ]);
      const currentValue = this.db.raw("?", [
        currentData[value.field as keyof T] as any,
      ]);

      if (value.isPointingToUser) {
        qb.where(
          allowedUserRef,
          "=",
          expectedData[value.field as keyof T] as any
        );
        return;
      }

      qb.where(expectedValue, "=", currentValue);
      return;
    }, qb);
  }

  private applyLostAccessWhere(context: SyncRequestContext, qb = this.qb) {
    qb = qb
      .andWhere((qb) => {
        this.applyWhereForState(context, "before", qb);
      })
      .andWhereNot((qb) => {
        this.applyWhereForState(context, "after", qb);
      });

    return qb;
  }

  private applyGainedAccessWhere(context: SyncRequestContext, qb = this.qb) {
    const { changed } = this;

    const before = pickBeforeFromChanges(changed.changes);
    const after = pickAfterFromChanges(changed.changes);

    qb = qb
      .andWhere((qb) => {
        this.applyWhereForState(context, "after", qb);
      })
      .andWhereNot((qb) => {
        this.applyWhereForState(context, "before", qb);
      });

    return qb;
  }

  buildGainedAndLostAccessQuery(context: SyncRequestContext) {
    let gainedQuery = new DeltaQueryBuilder(this.rule)
      .narrowToEntity(this.changed)
      .buildForType("put", context);
    let lostQuery = new DeltaQueryBuilder(this.rule)
      .narrowToEntity(this.changed)
      .buildForType("delete", context);

    gainedQuery = gainedQuery.andWhere((qb) => {
      return this.applyGainedAccessWhere(context, qb);
    });

    lostQuery = lostQuery.andWhere((qb) => {
      return this.applyLostAccessWhere(context, qb);
    });

    return this.db.queryBuilder().unionAll(gainedQuery, lostQuery);
  }

  build(context: SyncRequestContext) {
    return this.buildGainedAndLostAccessQuery(context);
  }
}

export class EntityUpdatedDeltaBuilder {
  constructor(
    public change: EntityChangesPointer<any>,
    public context: SyncRequestContext
  ) {
    this.change = change;
    this.context = context;
  }

  get db() {
    return this.context.db;
  }

  get impactedRules() {
    return this.context.permissions.entities
      .map((entity) => {
        return this.context.permissions.getPermissionRule(entity, "read");
      })
      .filter(isNotNullish)
      .filter((rule) => {
        return getIsRuleImpactedByChange(rule, this.change);
      });
  }

  build() {
    const queries = this.impactedRules
      .map((rule) => {
        return new SingleUpdateDeltaQueryBuilder(rule, this.change);
      })
      .map((builder) => {
        return builder.build(this.context);
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

  async insert(tr: Transaction) {
    let query = this.build()?.transacting(tr);

    if (!query) {
      return;
    }

    console.log("del", query.toString());

    const deltaResults = await query;

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
