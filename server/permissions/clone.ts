import { PermissionRuleModel, RelationRulesModel } from "./model";

function deepClone<T>(input: T): T {
  if (typeof input === "function") {
    return input;
  }

  if (typeof input !== "object" || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return (input as any).map(deepClone);
  }

  const result: any = {};

  for (const key in input) {
    result[key] = deepClone(input[key]);
  }

  return result;
}

function entries<K extends keyof any, V>(input: Record<K, V>): Array<[V, K]> {
  const result: Array<[V, K]> = [];

  for (const key in input) {
    result.push([input[key], key]);
  }

  return result;
}

export function clonePermissionRule<T>(
  rule: PermissionRuleModel<T>
): PermissionRuleModel<T> {
  const { $data, $entity, $parent, $relations, $schema, $and, $or } = rule;

  const $relationsClone = {} as typeof $relations;

  entries($relations as RelationRulesModel<any>).forEach(([rule, key]) => {
    if (!rule) {
      throw new Error("Bad state");
    }

    $relationsClone[key as keyof typeof $relations] = clonePermissionRule(
      rule!
    );
  });

  return {
    $data: deepClone($data),
    $entity: $entity,
    $parent: $parent,
    $schema: $schema,
    $relations: $relationsClone,
    $and: $and?.map((andRule) => clonePermissionRule(andRule)),
    $or: $or?.map((orRule) => clonePermissionRule(orRule)),
    $raw: rule.$raw,
  };
}
