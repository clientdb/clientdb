import {
  PersistanceAdapter,
  PersistanceAdapterInfo,
  PersistanceTableConfig,
} from "./persistanceAdapter";
import { EntityDefinition } from "./definition";
import { getHash } from "./utils/hash";

/**
 * This file is responsible for setting up persistance database.
 * It can potentially detect schema change and wipe out currently persisted data.
 *
 * Steps are:
 * 1. Setup 'system' database that holds information about all already existing storage databases and their schema hash.
 * 2. Setup 'current schema hash' and compare it with last one, if it changed - wipe out persisted data.
 */

// Name of 'system' database holding persistance storages with their schema hash
const DATABASES_DB_NAME = "clientdb-databases";
// Table we use in database above.
const DATABASES_DB_TABLE = "databases";

/**
 * What kind of data we hold about existing storage databases
 *
 * Note: this is part of 'system' database we should try to really rarely change.
 */
interface StoragePersistanceDatabaseInfo {
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
  name: string;
  version: number;
  schemaHash: string;
}

/**
 * We should hopefully never have to change this number, but in case we need to force-wipe-out entire data including system info,
 * we can upgrade this.
 *
 * Note: this version is independent from 'storage' database. This is for 'system info' database.
 */
const SYSTEM_DB_VERSION = 1;

/**
 * Will calculate schema hash for all entity definitions combined.
 */
function getDatabaseHash(
  definitions: EntityDefinition<unknown, unknown>[],
  nameSuffix = ""
): string {
  const hashList = definitions.map((definition) => definition.getSchemaHash());

  return getHash([...hashList, nameSuffix].join(""));
}

const cacheTableConfig: PersistanceTableConfig = {
  name: "__cache",
  keyField: "key",
};

/**
 * Will create persistance table info from entity definition
 */
function getTablesConfigFromDefinitions(
  definitions: EntityDefinition<unknown, unknown>[]
): PersistanceTableConfig[] {
  const entitiesTables = definitions.map(
    (definition): PersistanceTableConfig => {
      return {
        name: definition.config.name,
        keyField: definition.config.idField!,
      };
    }
  );

  return [...entitiesTables, cacheTableConfig];
}

/**
 * Will open and return 'system' table holding info about all existing databases.
 */
async function openLocalDatabasesInfoTable(
  { openDB }: PersistanceAdapter,
  onTerminated?: () => void
) {
  const databasesListDb = await openDB({
    name: DATABASES_DB_NAME,
    version: SYSTEM_DB_VERSION,
    tables: [
      {
        name: DATABASES_DB_TABLE,
        keyField: "name" as keyof StoragePersistanceDatabaseInfo,
      },
    ],
    onTerminated,
  });

  const databasesListTable =
    await databasesListDb.getTable<StoragePersistanceDatabaseInfo>(
      DATABASES_DB_TABLE
    );

  return databasesListTable;
}

/**
 * To avoid conflicts with other IndexedDb we always add clientdb string to database name.
 */
const STORAGE_DATABASE_NAME_BASE = "clientdb";

/*
 * Bump this anytime we make code changes that require purging previously synced data.
 * Examples are permission changes (making old data newly available), or syncing logic changes.
 * This does not include schema changes, as these already trigger a purge.
 */
const FORCED_VERSION_CHANGES = 1;

function getStorageDatabaseName(hash: string) {
  return `${STORAGE_DATABASE_NAME_BASE}-${FORCED_VERSION_CHANGES}-${hash}`;
}

/**
 * Will setup persistance storage database, and if needed wipe out existing data on schema change.
 */
export async function initializePersistance(
  definitions: EntityDefinition<unknown, unknown>[],
  { adapter, key }: PersistanceAdapterInfo,
  onTerminated?: () => void
) {
  const databaseHash = getDatabaseHash(definitions, key);
  const databaseName = getStorageDatabaseName(databaseHash);

  const allDatabasesInfoSystemTable = await openLocalDatabasesInfoTable(
    adapter,
    onTerminated
  );
  const existingDatabases = await allDatabasesInfoSystemTable.fetchAllItems();

  const existingDatabaseInfo =
    existingDatabases.find((dbInfo) => dbInfo.name === databaseName) ?? null;

  const entityTablesInfo = getTablesConfigFromDefinitions(definitions);

  const now = new Date();

  const outdatedDatabases = existingDatabases.filter((existingDb) => {
    return existingDb.name !== databaseName;
  });

  try {
    await Promise.all(
      outdatedDatabases.map(async (dbInfo) => {
        await adapter.removeDB(dbInfo.name);
        await allDatabasesInfoSystemTable.removeItem(dbInfo.name);
      })
    );
  } catch (error) {
    // We'll try again on next run. It is not blocking the bootstrap of the app, so we can continue even on error.
    console.error(`Failed to remove outdated databases`);
  }

  const persistanceDB = await adapter.openDB({
    name: databaseName,
    version: 1,
    tables: entityTablesInfo,
    onTerminated,
  });

  if (existingDatabaseInfo) {
    await allDatabasesInfoSystemTable.updateItem(databaseName, {
      lastUsedAt: now,
    });
  } else {
    await allDatabasesInfoSystemTable.saveItem({
      name: databaseName,
      version: 1,
      createdAt: now,
      lastUsedAt: now,
      schemaHash: databaseHash,
      updatedAt: now,
    });
  }

  return persistanceDB;
}
