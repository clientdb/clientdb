import {
  ContextValuePointer,
  ValuePointer,
  WhereValue,
  WhereValueConfig,
} from "./types";

import { Primitive } from "type-fest";
import { unsafeAssertType } from "../utils/assert";
import { SyncRequestContext } from "../server/context";

export function isPrimitive(input: unknown): input is Primitive {
  if (typeof input === "object" || typeof input === "function") {
    return input === null;
  }

  return true;
}

const configKeysMap: Record<keyof WhereValueConfig<any>, true> = {
  $eq: true,
  $ne: true,
  $gt: true,
  $gte: true,
  $lt: true,
  $lte: true,
  $in: true,
  $notIn: true,
};

const configKeys = Object.keys(configKeysMap) as Array<
  keyof WhereValueConfig<any>
>;

function getIsWhereValueConfig<T>(
  input: unknown
): input is WhereValueConfig<T> {
  unsafeAssertType<WhereValueConfig<T>>(input);
  if (typeof input !== "object") {
    return false;
  }

  for (const key of configKeys) {
    if (input[key] !== undefined) {
      return true;
    }
  }

  return false;
}

export function resolveValueInput<T>(
  value: WhereValue<T>
): WhereValueConfig<T> {
  if (getIsWhereValueConfig<T>(value)) {
    return value;
  }

  return { $eq: value as any as T };
}

export function getIsWhereValueConfigConstant<T>(input: WhereValueConfig<T>) {
  return configKeys.some((key) => {
    return input[key] !== undefined && typeof input[key] !== "function";
  });
}

export function resolveValuePointer<T>(
  value: ValuePointer<T>,
  context: SyncRequestContext
): T {
  if (typeof value === "function") {
    return (value as ContextValuePointer<T>)(context)!;
  }

  return value;
}
