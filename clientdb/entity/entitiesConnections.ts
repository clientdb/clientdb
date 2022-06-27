import { EntityClient } from "./client";
import { DbContext } from "./context";
import { EntityDefinition } from "./definition";

/**
 * This 'utils' object is created once per clientdb and is shared in multiple places allowing entities to communicate
 * between each other and reading database context
 */
export interface DatabaseLinker {
  getEntity<Data, Connections>(definition: EntityDefinition<Data, Connections>): EntityClient<Data, Connections>;
  getContextValue<D>(context: DbContext<D>): D;
}
