import { SyncRequestContext } from "../context";
import { DeltaType } from "../db/delta";
import { EntityPointer } from "../entity/pointer";
import { createDeltaQueryForChange } from "../query/delta/query";
import { Transaction } from "../query/types";
import { log } from "../utils/logger";

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

  log.verbose("delta query", deltaQuery.toString());

  const deltaResults = await deltaQuery;

  await tr.table("sync").insert(deltaResults);
}
