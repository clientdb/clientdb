export function pgTypeToTsType(udtName: string): string {
  switch (udtName) {
    case "bpchar":
    case "char":
    case "varchar":
    case "text":
    case "citext":
    case "uuid":
    case "bytea":
    case "inet":
    case "time":
    case "timetz":
    case "interval":
    case "name":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
    case "money":
    case "oid":
      return "number";
    case "bool":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    case "date":
    case "timestamp":
    case "timestamptz":
      return "Date";
    case "_int2":
    case "_int4":
    case "_int8":
    case "_float4":
    case "_float8":
    case "_numeric":
    case "_money":
      return "number[]";
    case "_bool":
      return "boolean[]";
    case "_varchar":
    case "_text":
    case "_citext":
    case "_uuid":
    case "_bytea":
      return "string[]";
    case "_json":
    case "_jsonb":
      return "Json[]";
    case "_timestamptz":
      return "Date[]";
    default:
      if (udtName.startsWith("_")) {
        const singularName = udtName.slice(1);
      }
      console.info(
        `Type ${udtName} has been mapped to [any] because no specific type has been found.`
      );
      return "any";
  }
}
