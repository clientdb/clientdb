import { Knex } from "knex";
import { PermissionRule } from "../../../schema/types";
import { SyncRequestContext } from "../../context";
import { getPermissionUserSelects } from "../select/userSelect";

interface AddedOrRemovedEntityInfo {
  // Entity that is either just created or about to be removed
  entity: string;
  id: string;
}

function createConcat(db: Knex, selects: string[], alias: string) {
  const placeholders = selects.map(() => `?`).join(" || '_' || ");
  const selectorRefs = selects.map((select) => {
    return db.ref(select);
  });

  return db.raw(`(${placeholders}) as ${alias}`, [...selectorRefs]);
}

function createCoalease(db: Knex, selects: string[], alias: string) {
  const placeholders = selects.map(() => `?`).join(", ");
  const selectorRefs = selects.map((select) => {
    return db.ref(select);
  });

  return db.raw(`coalesce(${placeholders}) as ${alias}`, [...selectorRefs]);
}

export function createUserIdCoalease(
  entity: string,
  rule: PermissionRule<unknown>,
  context: SyncRequestContext
) {
  const userSelects = getPermissionUserSelects(entity, rule, context);

  return createCoalease(context.db, userSelects, "user_id");
}
