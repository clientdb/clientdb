import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import { applyWhereTreeToQuery } from "@clientdb/server/query/where/builder";
import { Knex } from "knex";
import { DeltaWhereGetter } from "./baseQuery";
import { getChangedEntityPointerWhere } from "./changedWhere";
import { getRuleWhereMappingToAllowedUsers } from "./pointUser";
import { getRulePartNotImpactedBy } from "./split";

export const applyDeltaWhereOnCreatedOrRemoved: DeltaWhereGetter = ({
  change,
  context,
  entity,
  query,
}) => {
  const rule = pickPermissionsRule(context.permissions, entity, "read")!;

  if (!rule) {
    throw new Error(`Impacted entity ${entity} has no access rules.`);
  }

  const changedWhereTree = getChangedEntityPointerWhere(change, rule);

  const everyoneWithAccess = getRuleWhereMappingToAllowedUsers(
    entity,
    change,
    rule,
    context
  );

  query = query
    .andWhere((qb) => {
      applyWhereTreeToQuery(qb, changedWhereTree, context);
    })
    .andWhere((qb) => {
      applyWhereTreeToQuery(qb, everyoneWithAccess, context);
    });

  /**
   * For delta when changed entity impacts itself - everyone with access should receive update
   */
  if (entity === change.entity) {
    return query;
  }

  /**
   * Exclude those people who already had access to the entity.
   * eg. we create teamMembership for team owner, but team owner already had access to the team, so owner does not need to sync the team.
   */
  const peopleWithAccessBeforeRule = getRulePartNotImpactedBy(
    rule,
    change.entity
  );

  const peopleWithAccessBeforeWhere =
    !!peopleWithAccessBeforeRule &&
    getRuleWhereMappingToAllowedUsers(
      entity,
      change,
      peopleWithAccessBeforeRule,
      context
    );

  if (peopleWithAccessBeforeWhere) {
    query = query.andWhereNot((qb) => {
      applyWhereTreeToQuery(qb, peopleWithAccessBeforeWhere, context);
    });
  }

  return query;
};
