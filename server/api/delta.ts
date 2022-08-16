import { SyncRequestContext } from "@clientdb/server/context";
import { DeltaType } from "@clientdb/server/db/delta";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { createDeltaQueryForCreatedOrRemoved } from "@clientdb/server/query/delta/query";
import { QueryBuilder, Transaction } from "@clientdb/server/query/types";
import { log } from "@clientdb/server/utils/logger";

export async function insertDeltaForAddedOrRemoved(
  tr: Transaction,
  change: EntityPointer,
  context: SyncRequestContext,
  type: DeltaType
) {
  const deltaQuery = createDeltaQueryForCreatedOrRemoved(
    change,
    context,
    type
  ).transacting(tr);

  log.verbose("delta query", change, deltaQuery.toString());

  const deltaResults = await deltaQuery;

  if (!deltaResults.length) {
    return;
  }

  await tr.table("sync").insert(deltaResults);
}

export async function insertDeltaWithQuery(
  tr: Transaction,
  query: QueryBuilder
) {
  log("insertDeltaWithQuery delta query", query.toString());

  const deltaResults = await query;

  if (!deltaResults.length) {
    return;
  }

  await tr.table("sync").insert(deltaResults);
}
