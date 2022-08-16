import {
  ClassDetails,
  ConstraintType,
  Queryable,
  Schema,
} from "@databases/pg-schema-introspect";
import { getDbTypes, PgTypesLookup } from "./pgTypes";
import { getPlural } from "../../utils/pluralize";
import {
  DbSchema,
  SchemaEntity,
  SchemaEntityListRelation,
  SchemaEntityReferenceRelation,
} from "../../schema/schema";

import introspectDb from "@databases/pg-schema-introspect";
function convertReferenceRelationToListRelation(
  entity: SchemaEntity,
  referenceRelation: SchemaEntityReferenceRelation
): SchemaEntityListRelation {
  return {
    type: "collection",
    name: getPlural(entity.name),
    target: entity.name,
    field: referenceRelation.field,
  };
}

function getTypeById({ typesLookup }: ParseSchemaContext, typeId: number) {
  const type = typesLookup.get(typeId);
  if (!type) {
    return null;
  }

  return type;
}

function getClassById(context: ParseSchemaContext, classId: number) {
  return context.schema.classes.find((c) => c.classID === classId) ?? null;
}

function getClassAttributeById(
  context: ParseSchemaContext,
  classId: number,
  attributeNumber: number
) {
  const classInfo = getClassById(context, classId);
  if (!classInfo) {
    return null;
  }

  const foundAttr = classInfo.attributes.find(
    (attr) => attr.attributeNumber === attributeNumber
  );

  return foundAttr ?? null;
}

interface ClassFkRelations {}

function removeSuffix(name: string, suffix: string) {
  if (name.endsWith(suffix)) {
    return name.slice(0, -suffix.length);
  }

  return name;
}

function getReferenceRelationNameByFieldName(fieldName: string) {
  if (fieldName.endsWith("_id")) {
    return removeSuffix(fieldName, "_id");
  }

  return `${fieldName}_ref`;
}

function getClassIdKey(classInfo: ClassDetails, context: ParseSchemaContext) {
  const pkConstrain = classInfo.constraints.find(
    (constrain) => constrain.constraintType === ConstraintType.PrimaryKey
  );

  if (!pkConstrain) {
    throw new Error("Class has no PK");
  }

  const tableAttribute = getClassAttributeById(
    context,
    classInfo.classID,
    pkConstrain.tableAttributeNumbers[0]
  )!;

  return tableAttribute.attributeName;
}

function getClassFkRelations(
  classInfo: ClassDetails,
  context: ParseSchemaContext
): SchemaEntityReferenceRelation[] {
  const relations: SchemaEntityReferenceRelation[] = [];
  for (const constraint of classInfo.constraints) {
    if (constraint.constraintType !== ConstraintType.ForeignKey) {
      continue;
    }

    const {
      classID,
      tableAttributeNumbers,
      referencedClassID,
      referencedAttributeNumbers,
    } = constraint;

    const referencedTable = getClassById(context, referencedClassID)!;

    const tableAttribute = getClassAttributeById(
      context,
      classID,
      tableAttributeNumbers[0]
    )!;

    const referencedAttribute = getClassAttributeById(
      context,
      referencedClassID,
      referencedAttributeNumbers[0]
    )!;

    relations.push({
      type: "reference",
      isNullable: !tableAttribute.notNull,
      name: getReferenceRelationNameByFieldName(tableAttribute.attributeName),
      target: context.classEntityLookup.get(referencedTable)!.name,
      field: tableAttribute.attributeName,
    });
  }

  return relations;
}

function parseClass(
  classInfo: ClassDetails,
  context: ParseSchemaContext
): SchemaEntity {
  const idField = getClassIdKey(classInfo, context);
  const entity: SchemaEntity = {
    name: classInfo.className,
    idField,
    attributes: [],
    relations: [],
  };

  for (const rawAttribute of classInfo.attributes) {
    entity.attributes.push({
      name: rawAttribute.attributeName,
      type: getTypeById(context, rawAttribute.typeID) ?? "any",
      isNullable: !rawAttribute.notNull,
    });
  }

  return entity;
}

interface ParseSchemaContext {
  typesLookup: PgTypesLookup;
  classEntityLookup: Map<ClassDetails, SchemaEntity>;
  schema: Schema;
}

function findEntityByName(entityes: SchemaEntity[], name: string) {
  return entityes.find((e) => e.name === name);
}

export function parseDatabaseSchemaWithContext(
  context: ParseSchemaContext
): DbSchema {
  const { schema } = context;
  const { classes, types } = schema;

  const entities = classes.map((classInfo) => {
    const entity = parseClass(classInfo, context);

    context.classEntityLookup.set(classInfo, entity);

    return entity;
  });

  for (const classInfo of classes) {
    const entity = context.classEntityLookup.get(classInfo)!;

    const referenceRelations = getClassFkRelations(classInfo, context);

    for (const referenceRelation of referenceRelations) {
      entity.relations.push(referenceRelation);

      const referencedEntityRef = findEntityByName(
        entities,
        referenceRelation.target
      )!;

      referencedEntityRef.relations.push(
        convertReferenceRelationToListRelation(entity, referenceRelation)
      );
    }
  }

  return { entities };
}

export async function introspectPGSchema(
  connection: Queryable
): Promise<DbSchema> {
  const typesLookup = await getDbTypes(connection);
  const classEntityLookup = new Map<ClassDetails, SchemaEntity>();

  const schema = await introspectDb(connection);

  return parseDatabaseSchemaWithContext({
    typesLookup,
    classEntityLookup,
    schema,
  });
}
