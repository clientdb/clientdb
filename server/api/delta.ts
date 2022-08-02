import { SyncRequestContext } from "@clientdb/server/context";
import { DeltaType } from "@clientdb/server/db/delta";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { createDeltaQueryForChange } from "@clientdb/server/query/delta/query";
import { Transaction } from "@clientdb/server/query/types";
import { log } from "@clientdb/server/utils/logger";

export async function insertDeltaForChange(
  tr: Transaction,
  change: EntityPointer,
  context: SyncRequestContext,
  type: DeltaType
) {
  const deltaQuery = createDeltaQueryForChange(
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
