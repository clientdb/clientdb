import { Knex } from "knex";
import { SyncRequestContext } from "../context";
import { EntityPointer } from "../entity/pointer";
import { Transaction } from "../query/types";
import { DeltaType } from "./delta";
import { PermissionQueryBuilder } from "./PermissionQueryBuilder";
import { PermissionRule } from "./PermissionRule";

export class DeltaQueryBuilder extends PermissionQueryBuilder {
  constructor(public rule: PermissionRule, public context: SyncRequestContext) {
    super(context);
    this.reset();
  }

  reset() {
    super.reset();
    this.qb = this.db.queryBuilder().table(`${this.entityName}`);
    return this;
  }

  get entity() {
    return this.rule.entity;
  }

  get entityName() {
    return this.entity.name;
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
      entityIdRef: this.db.ref(entityId),
      allowedUserId,
      allowedUserIdRef: this.db.ref(allowedUserId),
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

    return this;
  }

  /**
   * Will require given entity to be part of query at any level of permission
   */
  narrowToEntity(pointer: EntityPointer) {
    const narrowRule = this.rule.addPrefix("narrow");
    const isSelfPointing = pointer.entity === this.rule.entity.name;

    this.qb = this.qb.whereExists((qb) => {
      qb.from(`${narrowRule.entity.name} as ${narrowRule.selector}`);
      qb = this.applyRuleJoins(narrowRule, qb);

      qb.andWhere(
        narrowRule.idSelector,
        "=",
        this.selectors.entityIdRef
      ).andWhere((qb) => {
        for (const { rule } of narrowRule) {
          qb = qb.orWhere((qb) => {
            if (rule?.entity.name === pointer.entity) {
              qb = qb.andWhere(rule.idSelector, "=", pointer.id);
            }

            if (rule?.entity.name === this.rule.entity.name && isSelfPointing) {
              qb = qb.andWhere(
                rule.idSelector,
                "=",
                this.selectors.entityIdRef
              );
            }
          });
        }
      });
    });

    return this;
  }

  preNarrowToUser() {
    return this;
    this.applyRule(this.rule, (qb, { value }) => {
      if (value?.isPointingToUser) {
        qb.where(value.selector, "=", this.selectors.allowedUserIdRef);
      }
    });

    return this;
  }

  prepareForType(type: DeltaType) {
    this.applySelect(type)
      .crossJoinUsers()
      // .groupForUniqueDelta()
      .preNarrowToUser();

    return this;
  }

  async insert(tr: Transaction) {
    let query = this.query.transacting(tr);

    const deltaResults = await query;

    if (!deltaResults.length) {
      return;
    }

    await tr.table("sync").insert(deltaResults);
  }
}

function getDoesRuleDirectlyIncludePointer(
  rule: PermissionRule,
  pointer: EntityPointer
) {
  if (rule?.entity.name === pointer.entity) {
    return true;
  }

  return false;
}

function getDoesRuleIncludePointer(
  ruleToCheck: PermissionRule,
  pointer: EntityPointer
) {
  for (const { rule } of ruleToCheck) {
    if (rule && getDoesRuleDirectlyIncludePointer(rule, pointer)) {
      return true;
    }
  }

  return false;
}
