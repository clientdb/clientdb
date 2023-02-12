import { ClientDb } from "./db";
import { Entity } from "./entity";
import { EntityChangeEvent } from "./events";
import { pickAfterFromChanges, pickBeforeFromChanges } from "./utils/changes";
import { typedKeys } from "./utils/object";

/**
 * Important notices:
 *
 * There are 2 ways of doing changes in cdb. One is via 'client' and another is via 'store' directly.
 *
 * Client changes are supposed to be emitted or synced elsewhere.
 * Store changes only change 'memory state' of the store without emitting those changes.
 *
 * It is important as there is difference between rollback and undo of transaction:
 * - rollback means some transaction failed - we undo it without re-emitting undo change (thus done directly via store)
 * - undo means we want to undo the transaction even if it was successful - it means it will also need to be re-emitted and synced.
 */

export type Change = EntityChangeEvent<unknown, unknown>;
type AnyEntity = Entity<unknown, unknown>;

/**
 * General architecture:
 *
 * All transactions are instantly applied in memory so entities react to them in optimistic way
 * Every change in transaction, however is registered next to corresponding entity.
 * Registered change is kept there until entire transaction is marked as commited.
 *
 * If some transaction is rejected, we need to undo all changes it made
 * BUT: it is possible that some other changes happened in the meantime, so we need to rebase those changes
 *
 * Thus the flow of rejecting change is:
 * - undo it in memory so we're sure entity has original data it had before change
 * - rebase all changes made in the meantime so entity will have all other changes applied as if rejected change never happened
 */

const entityChanges = new WeakMap<AnyEntity, Set<Change>>();

/**
 * Stick change to entity as parent transaction is not yet commited
 */
function registerEntityChange(change: Change) {
  let changes = entityChanges.get(change.entity);

  if (!changes) {
    changes = new Set();
    entityChanges.set(change.entity, changes);
  }

  changes.add(change);
}

function removeChange(changeToRemove: Change) {
  const changes = getEntityChanges(changeToRemove.entity);

  if (!changes) {
    throw new Error("No registered changes");
  }

  if (!changes.has(changeToRemove)) {
    console.warn("Did not delete");
    return;
  }

  changes.delete(changeToRemove);
}

/**
 * If we reject 'initial' change, while 'next' change is already pending, we need to tell 'next' change how to restore initial state of entity.
 *
 * To do that, we'll inject 'before' change values from initial change to next change
 */
function removeChangeAndUpdateNextTransaction(
  changes: Set<Change>,
  changeToRemove: Change
) {
  // There is no need of rebasing - there is only one change
  if (changes.size === 1) {
    changes.delete(changeToRemove);
    return;
  }

  const changesArray = Array.from(changes);
  const changeIndex = changesArray.indexOf(changeToRemove);

  const nextChange = changesArray[changeIndex + 1];

  // Our change is last in the queue, there is no need to inform previous ones how to restore initial state
  if (!nextChange) {
    changes.delete(changeToRemove);
    return;
  }

  // We only support update restoring. It seems to make no sense as there is no way you'd remove and undo-remove the same entity in the same transaction.
  // TODO: we could warn / throw if somehow that would happen as it could lead to quite nasty bugs
  if (nextChange.type !== "updated" || changeToRemove.type !== "updated") {
    changes.delete(changeToRemove);
    return;
  }

  // Move all 'before' values from previous change that will now be removed to 'next' change that now needs to be able to restore initial state of entity.
  const changedKeys = typedKeys(changeToRemove.changes);

  for (const changedKey of changedKeys) {
    // Next change is not modifying the same fields as this one, there is no need to inform it about this field as it did not change it.
    if (!nextChange.changes.hasOwnProperty(changedKey)) continue;

    const valueBeforeChange = changeToRemove.changes[changedKey][0];

    if (nextChange.changes.hasOwnProperty(changedKey)) {
      nextChange.changes[changedKey][0] = valueBeforeChange;
    }
  }

  changes.delete(changeToRemove);
}

function deregisterEntityChange(change: Change) {
  const changes = getEntityChanges(change.entity);

  if (!changes) {
    throw new Error("No registered changes");
  }

  if (!changes.has(change)) {
    console.warn("Did not delete");
    return;
  }

  removeChangeAndUpdateNextTransaction(changes, change);
}

/**
 * Note:
 *
 * functions below are usually used together, but they're explicitly small to avoid them being too magical and hard to understand
 */

function getEntityChanges(entity: AnyEntity) {
  return entityChanges.get(entity);
}

function reapplyEntityChange(change: Change) {
  const { entity } = change;
  switch (change.type) {
    case "created": {
      // Nothing to apply
      if (entity.store.findById(entity.getId())) return;

      entity.store.add(change.entity);
      return;
    }
    case "removed": {
      // Nothing to apply
      if (!entity.store.findById(entity.getId())) return;

      entity.store.remove(change.entity.getId());
      return;
    }
    case "updated": {
      entity.store.update(entity.getId(), pickAfterFromChanges(change.changes));
    }
  }
}

function undoEntityChange(change: Change) {
  switch (change.type) {
    case "created":
      change.entity.client.remove(change.entity.getId());
      return;
    case "removed":
      change.entity.client.create(change.entity.getData() as Partial<unknown>);
      return;
    case "updated":
      change.entity.client.update(
        change.entity.getId(),
        pickBeforeFromChanges(change.changes)
      );
  }
}

/**
 * Will get all pending transactions for given entity and re-apply them
 */
function rebaseEntityChanges(entity: AnyEntity) {
  const changes = getEntityChanges(entity);

  if (!changes) return;

  for (const change of changes) {
    reapplyEntityChange(change);
  }
}

export function createTransaction() {
  const changes: Change[] = [];

  let db: ClientDb | null = null;

  function pushChange(change: Change) {
    if (db && change.db !== db) {
      throw new Error(
        "Single transaction cannot include changes across multiple instances of clientdb"
      );
    }

    if (!db) {
      db = change.db;
    }

    registerEntityChange(change);
    changes.push(change);
  }

  function getChanges(): Change[] {
    return changes;
  }

  function commit() {
    for (const change of changes) {
      removeChange(change);
    }
  }

  function reject() {
    const entitiesToRebase = new Set<AnyEntity>();
    for (const change of changes) {
      entitiesToRebase.add(change.entity);
      change.rollback();
      deregisterEntityChange(change);
    }

    for (const entity of entitiesToRebase) {
      rebaseEntityChanges(entity);
    }
  }

  function undo() {
    const entitiesToRebase = new Set<AnyEntity>();
    for (const change of changes) {
      entitiesToRebase.add(change.entity);
      undoEntityChange(change);
    }

    for (const entity of entitiesToRebase) {
      rebaseEntityChanges(entity);
    }
  }

  return {
    pushChange,
    getChanges,
    commit,
    reject,
    undo,
  };
}

export type ClientDBTransaction = ReturnType<typeof createTransaction>;

export function createTransactionWithChanges(changes: Change[]) {
  const transaction = createTransaction();

  for (const change of changes) {
    transaction.pushChange(change);
  }

  return transaction;
}

let currentTransaction: ClientDBTransaction | null = null;

function emitTransaction(transaction: ClientDBTransaction) {
  const changes = transaction.getChanges();

  if (!changes.length) return;

  // We know db is the same for every change
  const [{ db }] = changes;

  db.events.emit("transaction", {
    type: "transaction",
    transaction: transaction,
  });
}

export function getCurrentTransaction() {
  return currentTransaction;
}

export function runTransaction<R>(callback: () => R) {
  if (currentTransaction) {
    throw new Error("Nested transactions are not supported");
  }

  currentTransaction = createTransaction();

  let result: R;

  try {
    result = callback();
  } catch (error) {
    const transaction = currentTransaction;
    currentTransaction = null;
    transaction.reject();

    throw error;
  }

  const transaction = currentTransaction;
  currentTransaction = null;

  emitTransaction(transaction);

  return [result!, transaction] as const;
}
