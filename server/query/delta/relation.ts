import { SchemaEntityRelation } from "@clientdb/schema";

export function getIsRelationImpactedBy(
  relation: SchemaEntityRelation,
  changedEntity: string
) {
  if (relation.type === "reference" && relation.target === changedEntity) {
    return true;
  }

  if (relation.type === "collection" && relation.target === changedEntity) {
    return true;
  }

  return false;
}
