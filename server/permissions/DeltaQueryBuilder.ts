import { Knex } from "knex";
import { SyncRequestContext } from "../context";
import { EntityPointer } from "../entity/pointer";
import { DeltaType } from "./delta";
import { PermissionQueryBuilder } from "./PermissionQueryBuilder";
import { PermissionRule } from "./PermissionRule";

export class DeltaQueryBuilder extends PermissionQueryBuilder {
  constructor(public rule: PermissionRule) {
    super(rule);
    this.qb = this.db.queryBuilder().table(this.entity.name);
  }

  private get dataFields() {
    const definedFields = this.rule.permissions.read?.fields as string[];

    if (definedFields) return definedFields;

    return this.entity.allAttributeNames;
  }

  get selectors() {
    const { entity, schema } = this;
    const entityId = `${entity.name}.${entity.idField}`;
    const allowedUserId = `allowed_user.${schema.userEntity.idField}`;

    return {
      entityId,
      allowedUserId,
      data: "data",
    };
  }

  private get filledDataColumn() {
    const { dataFields, db, selectors } = this;

    const jsonFieldsSpec = dataFields
      .map((field) => {
        const selector = db.ref(`${this.entity.name}.${field}`);
        // TODO: This is part of knex.select, so no direct risk of SQL injection, but ${field} could be sanitized
        return `'${field}', ${selector}`;
      })
      .join(", ");

    const aliasRef = db.ref(selectors.data);
    return db.raw(`json_build_object(${jsonFieldsSpec}) as ${aliasRef}`);
  }

  private get nullDataColumn() {
    return this.db.raw("json_build_object() as data");
  }

  private applySelect(type: DeltaType) {
    const { db } = this;
    const entityTypeColumn = db.raw("? as entity", [this.entityName]);
    const deltaTypeColumn = db.raw("? as type", [type]);

    this.qb = this.qb.select([
      entityTypeColumn,
      deltaTypeColumn,
      db.ref(`${this.selectors.entityId} as entity_id`),
      db.ref(`${this.selectors.allowedUserId} as user_id`),
      type === "put" ? this.filledDataColumn : this.nullDataColumn,
    ]);

    return this;
  }

  private crossJoinUsers() {
    this.qb = this.qb.crossJoin(
      this.db.ref(`${this.schema.userEntity.name} as allowed_user`)
    );

    return this;
  }

  private groupForUniqueDelta() {
    const { entityId, allowedUserId } = this.selectors;
    this.qb = this.qb.groupBy([entityId, allowedUserId]);
  }

  /**
   * Will require given entity to be part of query at any level of permission
   */
  narrowToEntity({ entity, id }: EntityPointer) {
    this.qb = this.qb.andWhere((qb) => {
      for (const { rule, value } of this.rule) {
        if (rule?.entity.name === entity) {
          qb.orWhere(rule.idSelector, "=", id);
        }
      }
    });

    return this;
  }

  buildForType(type: DeltaType, context: SyncRequestContext) {
    super.build(context);

    this.applySelect(type).crossJoinUsers().groupForUniqueDelta();

    return this.qb;
  }
}
