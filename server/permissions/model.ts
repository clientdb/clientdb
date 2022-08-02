import {
  DbSchemaModel,
  EntitySchemaData,
  EntitySchemaDataKeys,
  EntitySchemaRelations,
  RelationSchemaType,
} from "@clientdb/schema";
import { mapValues } from "../utils/object";
import {
  parseRule,
  pickDataPermissions,
  pickRelationPermissions,
} from "./ruleParser";
import {
  DataRules,
  EntityInputPreset,
  EntityPermissionsConfig,
  PermissionRule,
  SchemaPermissions,
} from "./types";

/**
 * Permissions model is a bit enchanced version of raw permissions input.
 *
 * Raw input is like:
 *
 * const canSeeTeam = {
 *   $or: [
 *     { owner_id: currentUser },
 *     {
 *       teamMemberships: {
 *         user_id: currentUser,
 *       }
 *     }
 *   ]
 * }
 *
 * This format is easy to write for end-user, but when single sub-permission of such rule is passed around, it has no informations about 'parent' rule or 'on what entity should this rule be applied',
 *
 * eg. if we pick only {user_id: currentUser} to perform some opeartions on it, we don't know that this rule is applied on `teamMembership` entity via field `teamMemberships` and we'd have to pass this information around, which is very error-prone.
 *
 * Thus such {user_id: currentUser} rule is transformed into: {user_id: currentUser, $entity: "teamMembership", $parent: { rule: { teamMemberships: { ... } }, key: "teamMemberships" }}}
 */

interface RuleLocation {
  $entity: string;
  $parent: PermissionRuleModel | null;
  $schema: DbSchemaModel;
}

interface PermissionLocation {
  $entity: string;
  $schema: DbSchemaModel;
}

export type DataRulesModel<DataSchema> = DataRules<DataSchema>;

export type RelationRuleModel<RelationPointer> = PermissionRuleModel<
  RelationSchemaType<RelationPointer>
>;

export type RelationRulesModel<RelationsSchema> = {
  [K in keyof RelationsSchema]?: RelationRuleModel<RelationsSchema[K]>;
};

export type EntityRulesModel<EntitySchema> = RuleLocation & {
  $data: DataRulesModel<EntitySchemaData<EntitySchema>>;
} & { $relations: RelationRulesModel<EntitySchemaRelations<EntitySchema>> };

export type PermissionRuleModel<EntitySchema = any> = RuleLocation &
  EntityRulesModel<EntitySchema> & {
    $or?: PermissionRuleModel<EntitySchema>[];
    $and?: PermissionRuleModel<EntitySchema>[];
  };

export type ReadPermissionModel<T> = PermissionLocation & {
  rule: PermissionRuleModel<T>;
  fields: Array<EntitySchemaDataKeys<T>>;
};

export type CreatePermissionModel<T> = PermissionLocation & {
  rule: PermissionRuleModel<T>;
  fields: Array<EntitySchemaDataKeys<T>>;
  preset?: EntityInputPreset<T>;
};

export type UpdatePermissionModel<T> = PermissionLocation & {
  rule: PermissionRuleModel<T>;
  fields: Array<EntitySchemaDataKeys<T>>;
};

export type RemovePermissionModel<T> = PermissionRuleModel<T>;

export type EntityPermissionsModel<T> = {
  read?: ReadPermissionModel<T>;
  create?: CreatePermissionModel<T>;
  update?: UpdatePermissionModel<T>;
  remove?: RemovePermissionModel<T>;
};

export type SchemaPermissionsModel<S = any> = {
  [K in keyof S]: EntityPermissionsModel<S[K]>;
};

function createRuleModel<T>(
  ruleEntity: string,
  rule: PermissionRule<T>,
  parentRule: PermissionRuleModel<any> | null,
  schema: DbSchemaModel
): PermissionRuleModel<T> {
  const location: RuleLocation = {
    $entity: ruleEntity,
    $parent: parentRule,
    $schema: schema,
  };

  const ruleModel: PermissionRuleModel<T> = {
    ...location,
    $data: {},
    $relations: {},
  } as PermissionRuleModel<T>;

  const dataPermissions = pickDataPermissions(rule, ruleEntity, schema);
  const relationPermissions = pickRelationPermissions(rule, ruleEntity, schema);

  if (Object.keys(dataPermissions).length > 0) {
    ruleModel.$data = dataPermissions;
  }

  const { $and, $or } = rule;

  if (Object.keys(relationPermissions).length > 0) {
    for (const relationKey in relationPermissions) {
      const relationRule = relationPermissions[relationKey]!;

      const relationEntity = schema.getFieldTargetEntity(
        ruleEntity,
        relationKey as string
      );

      if (!relationEntity) {
        throw new Error(
          `Relation ${relationKey as string} is not defined in schema`
        );
      }

      const relationRuleModel = createRuleModel(
        relationEntity.name,
        relationRule,
        ruleModel,
        schema
      );

      Reflect.set(ruleModel.$relations, relationKey, relationRuleModel);
    }
  }

  const orModels = $or?.map((orRule) => {
    return createRuleModel(ruleEntity, orRule, ruleModel, schema);
  });

  const andModels = $and?.map((andRule) => {
    return createRuleModel(ruleEntity, andRule, ruleModel, schema);
  });

  if (orModels) {
    ruleModel.$or = orModels;
  }

  if (andModels) {
    ruleModel.$and = andModels;
  }

  return ruleModel;
}

function createEntityPermissionsModel<T>(
  entity: string,
  config: EntityPermissionsConfig<T>,
  schema: DbSchemaModel
): EntityPermissionsModel<T> {
  const location: PermissionLocation = { $entity: entity, $schema: schema };

  const { read, create, update, remove } = config;
  const model: EntityPermissionsModel<T> = {};

  const entityInfo = schema.getEntity(entity);

  if (!entityInfo) {
    throw new Error(`Entity ${entity} is not defined in schema`);
  }

  const allFields = entityInfo.attributes.map(
    (attribute) => attribute.name
  ) as Array<EntitySchemaDataKeys<T>>;

  if (read) {
    model.read = {
      ...location,
      rule: createRuleModel(entity, read.rule, null, schema),
      fields: read.fields ?? allFields,
    };
  }

  if (create) {
    model.create = {
      ...location,
      rule: createRuleModel(entity, create.rule, null, schema),
      fields: create.fields ?? allFields,
      preset: create.preset,
    };
  }

  if (update) {
    model.update = {
      ...location,
      rule: createRuleModel(entity, update.rule, null, schema),
      fields: update.fields ?? allFields,
    };
  }

  if (remove) {
    model.remove = createRuleModel(entity, remove, null, schema);
  }

  return model;
}

export function createSchemaPermissionsModel<S = any>(
  schemaPermissions: SchemaPermissions<S>,
  schema: DbSchemaModel
): SchemaPermissionsModel<S> {
  const model: SchemaPermissionsModel<S> = {} as SchemaPermissionsModel<S>;

  for (const entityName in schemaPermissions) {
    const permissionsConfig = schemaPermissions[entityName];

    const permissionsModel = createEntityPermissionsModel(
      entityName,
      permissionsConfig,
      schema
    );

    model[entityName] = permissionsModel;
  }

  return model;
}

export function getRawModelRule<T>(
  rule: PermissionRuleModel<T>
): PermissionRule<T> {
  const { $data, $relations, $and, $or } = rule;

  const rawRule: PermissionRule<T> = { ...$data } as PermissionRule<T>;

  const rawAnd = $and?.map((andRule) => {
    return getRawModelRule(andRule);
  });

  const rawOr = $or?.map((orRule) => {
    return getRawModelRule(orRule);
  });

  if ($relations) {
    for (const relationKey in $relations) {
      const relationRule = ($relations as RelationRulesModel<any>)[
        relationKey
      ]!;

      const relationRuleRaw = getRawModelRule(relationRule);

      Reflect.set(rawRule, relationKey, relationRuleRaw);
    }
  }

  if ($and?.length) {
    rawRule.$and = rawAnd;
  }

  if ($or?.length) {
    rawRule.$or = rawOr;
  }

  return rawRule;
}
