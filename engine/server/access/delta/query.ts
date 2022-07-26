import { SyncRequestContext } from "../../context";
import { getEntitiesWithAccessBasedOn } from "./impact";

interface Input {
  entity: string;
  id: string;
  context: SyncRequestContext;
}

function createExactEntityWhere(input: Input, comparator: "=" | "!=") {
  const { entity, id, context } = input;

  context.db.where(`${entity}.id`, id);
}

function createQueryOfEntitiesAccessedOnlyThanksTo(
  impactedEntity: string,
  input: Input
) {
  const { entity, id, context } = input;

  input.context.db.from(impactedEntity);
}

export function createEntitiesAccessedThanksTo(input: Input) {
  const { entity, id, context } = input;

  const impactedEntities = getEntitiesWithAccessBasedOn(entity, context);

  impactedEntities.map((impactedEntity) => {
    createQueryOfEntitiesAccessedOnlyThanksTo(impactedEntity, input);
  });
}
