export type EntityRemoveChange<T> = {
  type: "remove";
  entity: T;
  id: string;
};

export type EntityUpdateChange<T, D> = {
  type: "update";
  entity: T;
  id: string;
  data: Partial<D>;
};

export type EntityCreateChange<T, D> = {
  type: "create";
  entity: T;
  data: Partial<D>;
};

export type EntityChange<T, D> =
  | EntityRemoveChange<T>
  | EntityUpdateChange<T, D>
  | EntityCreateChange<T, D>;
