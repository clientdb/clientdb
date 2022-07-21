// B+ tree by David Piepgrass. License: MIT
import { defaultComparator } from "./compare";
import { BNode, BNodeInternal } from "./node";

export function iterator<T>(
  next: () => IteratorResult<T> = () => ({ done: true, value: undefined })
): IterableIterator<T> {
  var result: any = { next };
  if (Symbol && Symbol.iterator)
    result[Symbol.iterator] = function () {
      return this;
    };
  return result;
}
