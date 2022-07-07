/**
 * Information about what caused given update in the system. This has important meaning, especially to avoid infinite
 * loops of updates.
 *
 * eg. sync manager is listening to all create/update/delete changes in the store, but only those caused by user
 * should be pushed to the server.
 *
 * For example: on initial load, we load items from local persistance and then add them to the store.
 * This 'adding' should not cause pushing to the server, as it is not user change, we already had them, etc.
 */
export type EntityChangeSource = "user" | "sync" | "persistance";
