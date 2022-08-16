import { v5 } from "uuid";

export function createDeterministicUUID(seed = 0) {
  const namespace = "a3b8086f-3d50-4818-b4d1-ffbe8be24d1a";

  let counter = seed;
  return function getNextUUID() {
    const name = `${counter++}-${seed}`;
    return v5(name, namespace);
  };
}
