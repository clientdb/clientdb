import { SchemaEntityRelation } from "../../../schema/schema";

export function getIsRelationImpactedBy(
  relation: SchemaEntityRelation,
  changedEntity: string
) {
  if (
    relation.type === "reference" &&
    relation.referencedEntity === changedEntity
  ) {
    return true;
  }

  if (
    relation.type === "collection" &&
    relation.referencedByEntity === changedEntity
  ) {
    return true;
  }

  return false;
}
