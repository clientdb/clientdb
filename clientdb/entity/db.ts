import { EntityClient } from "./client";
import { DbContext } from "./context";
import { EntityDefinition } from "./definition";

export type ClientDb = {
  destroy: () => void;
  entity<D, V>(definition: EntityDefinition<D, V>): EntityClient<D, V>;
  getContextValue<D>(context: DbContext<D>): D;
};
