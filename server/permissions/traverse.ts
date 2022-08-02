import { SchemaEntity, SchemaEntityRelation } from "@clientdb/schema";
import { unsafeAssertType } from "../utils/assert";
import {
  EntityRulesModel,
  getRawModelRule,
  PermissionRuleModel,
  RelationRuleModel,
} from "./model";
import { ConditionGroupSegment, ValueRuleConfig } from "./types";
import { resolveValueInput } from "./value";

interface TraverseStepInfo {
  schemaPath: string[];
  selector: string;
  conditionPath: ConditionGroupSegment[];
  entity: string;
}

export interface TraverseRelationInfo extends TraverseStepInfo {
  rule: RelationRuleModel<any>;
}

export interface TraverseValueInfo extends TraverseStepInfo {
  referencedEntity: string | null;
  rule: ValueRuleConfig<any>;
  parentRule: RelationRuleModel<any>;
}

export interface TraverseLevelInfo extends TraverseStepInfo {
  rule: EntityRulesModel<any>;
}

interface TraverseCallbacks<R = void> {
  onRelation?: (info: TraverseRelationInfo) => R;
  onValue?: (info: TraverseValueInfo) => R;
}

function traverseRuleStep<T>(
  info: TraverseStepInfo,
  rule: EntityRulesModel<T>,
  callbacks: TraverseCallbacks
) {
  const schema = rule.$schema;

  for (const [key, fieldInfo] of Object.entries(rule.$data ?? {})) {
    const valueRule = resolveValueInput(fieldInfo);

    const referencedEntity =
      schema.getEntityReferencedBy(info.entity, key as string)?.name ?? null;

    callbacks.onValue?.({
      ...info,
      schemaPath: [...info.schemaPath, key],
      rule: valueRule,
      parentRule: rule,
      selector: `${info.schemaPath.join("__")}.${key}`,
      referencedEntity,
    });
  }

  for (const [relationField, relationRule] of Object.entries(
    rule.$relations ?? {}
  )) {
    unsafeAssertType<RelationRuleModel<any>>(relationRule);

    const relation = schema.getRelation(info.entity, relationField as string)!;
    const targetEntity = schema.getFieldTargetEntity(
      info.entity,
      relationField as string
    );

    if (!targetEntity) {
      throw new Error(
        `No target entity for relation ${relationField as string} in entity ${
          info.entity
        }`
      );
    }

    const relationSchemaPath = [...info.schemaPath, relationField];

    const nestedStep: TraverseStepInfo = {
      ...info,
      schemaPath: relationSchemaPath,
      entity: targetEntity.name,
      selector: relationSchemaPath.join("__"),
    };

    callbacks?.onRelation?.({ ...nestedStep, rule: relationRule });

    traverseRuleWithPath(nestedStep, relationRule, callbacks);
  }
}

function traverseRuleWithPath<T>(
  info: TraverseStepInfo,
  inputRule: PermissionRuleModel<T>,
  callbacks: TraverseCallbacks
) {
  traverseRuleStep(info, inputRule, callbacks);

  inputRule.$and
    ?.map((andRule, index) => {
      return traverseRuleWithPath(
        {
          ...info,
          conditionPath: [...info.conditionPath, "and", index],
        },
        andRule,
        callbacks
      );
    })
    .flat();

  inputRule.$or
    ?.map((orRule, index) => {
      return traverseRuleWithPath(
        {
          ...info,
          conditionPath: [...info.conditionPath, "or", index],
        },
        orRule,
        callbacks
      );
    })
    .flat();
}

export function traverseRule(
  rule: PermissionRuleModel<unknown>,
  callbacks: TraverseCallbacks
) {
  const rootStepInfo: TraverseStepInfo = {
    schemaPath: [rule.$entity],
    conditionPath: [],
    selector: rule.$entity,
    entity: rule.$entity,
  };

  callbacks.onRelation?.({ ...rootStepInfo, rule: rule });
  return traverseRuleWithPath(rootStepInfo, rule, callbacks);
}

export function pickFromRule<R>(
  permissions: PermissionRuleModel<unknown>,
  callbacks: TraverseCallbacks<R | undefined | void>
) {
  const results: R[] = [];

  traverseRule(permissions, {
    onValue(info) {
      if (callbacks.onValue) {
        const result = callbacks.onValue(info);

        if (result !== undefined) {
          results.push(result);
        }
      }
    },
    onRelation(info) {
      if (callbacks.onRelation) {
        const result = callbacks.onRelation(info);

        if (result !== undefined) {
          results.push(result);
        }
      }
    },
  });

  return results;
}

export function getRuleHas<R>(
  permissions: PermissionRuleModel<unknown>,
  callbacks: TraverseCallbacks<boolean>
) {
  let hasSome = false;

  traverseRule(permissions, {
    onValue(info) {
      if (hasSome) return;

      if (!callbacks.onValue) return;

      hasSome = callbacks.onValue(info);
    },
    onRelation(info) {
      if (hasSome) return;

      if (!callbacks.onRelation) return;

      hasSome = callbacks.onRelation(info);
    },
  });

  return hasSome;
}
