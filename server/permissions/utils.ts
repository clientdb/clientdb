import {
  ContextValuePointer,
  ValuePointer,
  ValueRuleInput,
  ValueRuleConfig,
} from "./types";

import { Primitive } from "type-fest";
import { unsafeAssertType } from "@clientdb/server/utils/assert";
import { SyncRequestContext } from "@clientdb/server/context";
import { memoize } from "lodash";

export function isPrimitive(input: unknown): input is Primitive {
  if (typeof input === "object" || typeof input === "function") {
    return input === null;
  }

  return true;
}

const configKeysMap: Record<keyof ValueRuleConfig<any>, true> = {
  $eq: true,
  $ne: true,
  $gt: true,
  $gte: true,
  $lt: true,
  $lte: true,
  $in: true,
  $notIn: true,
  $isNull: true,
};

const configKeys = Object.keys(configKeysMap) as Array<
  keyof ValueRuleConfig<any>
>;

function getIsWhereValueConfig<T>(input: unknown): input is ValueRuleConfig<T> {
  unsafeAssertType<ValueRuleConfig<T>>(input);
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
  value: ValueRuleInput<T>
): ValueRuleConfig<T> {
  if (getIsWhereValueConfig<T>(value)) {
    return value;
  }

  return { $eq: value as any as T };
}

export function getIsWhereValueConfigConstant<T>(input: ValueRuleConfig<T>) {
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

function findTargetPropertyDescriptor<T extends object>(
  target: T,
  prop: keyof T
) {
  let descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

  if (descriptor) return descriptor;

  let MaybeParentClass = Reflect.getPrototypeOf(target);

  while (MaybeParentClass && MaybeParentClass !== Object.prototype) {
    descriptor = Reflect.getOwnPropertyDescriptor(MaybeParentClass, prop);

    if (descriptor) return descriptor;

    MaybeParentClass = Reflect.getPrototypeOf(MaybeParentClass);
  }
}

export function memoizeGetters<T extends object>(
  object: T,
  ...keys: Array<keyof T>
) {
  for (const key of keys) {
    const descriptor = findTargetPropertyDescriptor(object, key);

    if (!descriptor) {
      throw new Error(
        `Could not find property descriptor for ${key as string}`
      );
    }

    if (!descriptor.get) {
      throw new Error(`Property ${key as string} is not a getter`);
    }

    const getter = descriptor.get;

    const memoizedGetter = memoize(getter);

    Object.defineProperty(object, key, {
      ...descriptor,
      get: memoizedGetter,
    });
  }
}
