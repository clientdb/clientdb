import { EntitiesSchema } from "@clientdb/schema";
import { mapValues } from "lodash";
import { SyncServerConfig } from "../server/config";
import {
  PermissionOperationType,
  PermissionRuleInput,
  SchemaPermissions,
  SchemaRules,
} from "./input";
import { PermissionRule } from "./PermissionRule";

export class PermissionsRoot<Schema> {
  constructor(
    private input: SchemaPermissions<Schema>,
    private schema: EntitiesSchema
  ) {}

  getPermission<T extends PermissionOperationType>(
    entity: keyof Schema,
    type: T
  ) {
    const rawPermission = this.input[entity][type];

    if (!rawPermission) {
      return;
    }
  }

  getPermissions(entity: keyof Schema) {
    const rawPermission = this.input[entity];

    return rawPermission;
  }

  get entities() {
    return Object.keys(this.input) as Array<keyof Schema>;
  }

  getPermissionFields<T extends PermissionOperationType>(
    entity: keyof Schema,
    type: T
  ) {
    const permission = this.input[entity];

    if (type === "remove") {
      return undefined;
    }

    if (type === "create") {
      return permission.create?.fields;
    }

    if (type === "update") {
      return permission.update?.fields;
    }

    if (type === "read") {
      return permission.read?.fields;
    }

    throw new Error(`Unknown operation ${type}`);
  }

  private getRawPermissionRule<T extends PermissionOperationType>(
    entity: keyof Schema,
    type: T
  ): PermissionRuleInput<any> | undefined {
    const permission = this.input[entity];

    if (type === "remove") {
      return permission.remove;
    }

    if (type === "create") {
      return permission.create?.rule;
    }

    if (type === "update") {
      return permission.update?.rule;
    }

    if (type === "read") {
      return permission.read?.rule;
    }

    throw new Error(`Unknown operation ${type}`);
  }

  getPermissionRule<T extends PermissionOperationType>(
    entity: keyof Schema,
    type: T
  ): PermissionRule | null {
    const rawRule = this.getRawPermissionRule(entity, type);

    if (!rawRule) return null;

    return new PermissionRule({
      entity: this.schema.assertEntity(entity as string),
      input: rawRule,
      parentInfo: null,
      schema: this.schema,
      permissions: this,
    });
  }

  assertPermissionRule<T extends PermissionOperationType>(
    entity: keyof Schema,
    type: T
  ): PermissionRule {
    const rule = this.getPermissionRule(entity, type);

    if (!rule) {
      throw new Error(`No permission rule for ${entity as string} ${type}`);
    }

    return rule;
  }
}
