import { Changes } from "../utils/changes";

export interface EntityPointer {
  entity: string;
  id: string;
}

export interface EntityChangesPointer<T> extends EntityPointer {
  changes: Changes<T>;
}
