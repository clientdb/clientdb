import { ValueRuleConfig } from "./types";

export function doesValueMatchValueConfig<T>(
  value: T,
  valueConfig: ValueRuleConfig<T>
) {
  const { $eq, $gt, $gte, $in, $isNull, $lt, $lte, $ne, $notIn } = valueConfig;

  if ($eq) {
    if (typeof $eq === "function") return false;

    return value === $eq;
  }

  if ($gt) {
    if (typeof $gt === "function") return false;

    return value > $gt;
  }

  if ($gte) {
    if (typeof $gte === "function") return false;

    return value >= $gte;
  }

  if ($in) {
    if (typeof $in === "function") return false;

    return $in.includes(value);
  }

  if ($isNull) {
    if (typeof $isNull === "function") return false;

    return $isNull === true;
  }

  if ($lt) {
    if (typeof $lt === "function") return false;

    return value < $lt;
  }

  if ($lte) {
    if (typeof $lte === "function") return false;

    return value <= $lte;
  }

  if ($ne) {
    if (typeof $ne === "function") return false;

    return value !== $ne;
  }

  if ($notIn) {
    if (typeof $notIn === "function") return false;

    return !$notIn.includes(value);
  }

  throw new Error(`Unhandled value config: ${JSON.stringify(valueConfig)}`);
}
