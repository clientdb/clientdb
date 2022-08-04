import { SyncRequestContext } from "../context";
import { EntityPointer } from "../entity/pointer";
import { Transaction } from "../query/types";
import { isNotNullish } from "../utils/nullish";
import { DeltaType } from "./delta";
import { ExistsDeltaQueryBuilder } from "./ExistsDeltaQueryBuilder";

export class EntityAddedOrRemovedDeltaBuilder {
  constructor(
    public change: EntityPointer,
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
        return rule.getDoesDependOn(this.change.entity);
      });
  }

  buildForType(type: DeltaType, context: SyncRequestContext) {
    const queries = this.impactedRules
      .map((rule) => {
        return new ExistsDeltaQueryBuilder(rule, this.change);
      })
      .map((builder) => {
        return builder.buildForType(type, context);
      });

    const qb = this.db.queryBuilder();

    const allDeltaQuery = queries.reduce((qb, nextDeltaQuery) => {
      return qb.unionAll(nextDeltaQuery, true);
    }, qb);

    return allDeltaQuery;
  }

  async insert(tr: Transaction, type: DeltaType, context: SyncRequestContext) {
    let getDeltaQuery = this.buildForType(type, context).transacting(tr);

    const deltaResults = await getDeltaQuery;

    if (!deltaResults.length) {
      return;
    }

    await tr.table("sync").insert(deltaResults);
  }
}
