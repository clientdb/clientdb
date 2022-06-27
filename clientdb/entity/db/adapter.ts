export interface PersistanceTableConfig {
  name: string;
  keyField: string;
}

export interface PersistanceTableAdapter<Data> {
  saveItem(input: Data): Promise<boolean>;
  saveItems(input: Data[]): Promise<boolean>;
  removeItem(key: string): Promise<boolean>;
  removeItems(key: string[]): Promise<boolean>;
  fetchAllItems(): Promise<Data[]>;
  fetchItem(key: string): Promise<Data | null>;
  updateItem(key: string, input: Partial<Data>): Promise<boolean>;
  clearTable(): Promise<boolean>;
}

export interface PersistanceAdapterInfo {
  adapter: PersistanceAdapter;
  key?: string;
}

export interface PersistanceDbOpenInput {
  name: string;
  version: number;
  tables: PersistanceTableConfig[];
  onTerminated?: () => void;
}

export interface PersistanceDB {
  close(): Promise<void>;
  getTable<Data>(name: string): Promise<PersistanceTableAdapter<Data>>;
}

export interface PersistanceAdapter {
  openDB(input: PersistanceDbOpenInput): Promise<PersistanceDB>;
  removeDB(name: string): Promise<boolean>;
}
