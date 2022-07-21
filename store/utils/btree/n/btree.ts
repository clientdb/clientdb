function typeOf(item: any): string {
  const typeOfItem = typeof item;
  if (typeOfItem !== "object") {
    return typeOfItem;
  } else if (item === null) {
    return "null";
  } else {
    return Object.prototype.toString.call(item).slice(8, -1).toLowerCase();
  }
}

type CompareFunction<T> = (a: T, b: T) => number;

const defaultCompareFunction = <T>(a: T, b: T) => {
  const typeOfA = typeOf(a);
  const typeOfB = typeOf(b);
  if (typeOfA === typeOfB) {
    return a < b ? -1 : a > b ? 1 : 0;
  } else {
    return typeOfA < typeOfB ? -1 : 1;
  }
};

export class BTreeMap<K, V> {
  private _order: number = 3;
  private _compare: CompareFunction<K> = defaultCompareFunction;

  map: Map<K, V[]>;
  root: Node<K> | Leaf<K>;

  constructor(options: any = {}) {
    if (options.order !== undefined && options.order >= 3)
      this._order = options.order;
    if (options.comparator !== undefined) this._compare = options.comparator;
    this.map = new Map();
    this.root = new Leaf(this._order, this._compare);
  }

  // properties

  get lowest(): K {
    return this.root.lowest;
  }

  get highest(): K {
    return this.root.highest;
  }

  get order(): number {
    return this._order;
  }

  get size(): number {
    return this.map.size;
  }

  // data manipulation methods

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): BTreeMap<K, V> {
    const values = this.map.get(key);
    if (values !== undefined) {
      values.push(value);
    } else {
      this.map.set(key, [value]);
      this.root.set(key);
      if (this.root.keys.length > this.root.max) {
        const newRoot = new Node<K>(this._order, this._compare);
        const newChild = this.root.split();
        newRoot.keys.push(newChild.lowest);
        newRoot.children.push(this.root, newChild);
        this.root = newRoot;
      }
    }
    return this;
  }

  get(key: K): Array<V> {
    const values = this.map.get(key);

    return values!;
  }

  delete(key: K, endKey?: K, inclusive?: boolean): boolean {
    if (endKey) {
      let count = 0;
      const keys = Array.from(this.keys(key, endKey, inclusive));
      for (const key of keys) {
        if (this.delete(key)) count++;
      }
      return count > 0 ? true : false;
    } else {
      if (this.map.has(key)) {
        this.map.delete(key);
        this.root.delete(key);
        if (this.root.keys.length === 0) {
          this.root = this.root.shrink();
        }
        return true;
      } else {
        return false;
      }
    }
  }

  clear(): void {
    this.map = new Map();
    this.root = new Leaf(this._order, this._compare);
  }

  // iterators

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  *keys(
    start: K = this.lowest,
    end: K = this.highest,
    inclusive: boolean = true
  ): IterableIterator<K> {
    if (this.map.size === 0) return;
    let leaf: Leaf<K> | null = this.root.findLeaf(start);
    do {
      const keys = leaf.keys;
      for (let i = 0, length = keys.length; i < length; i++) {
        const key = keys[i];
        if (
          this._compare(key, start) >= 0 &&
          (inclusive
            ? this._compare(key, end) <= 0
            : this._compare(key, end) < 0)
        )
          yield key;
        if (this._compare(key, end) > 0) break;
      }
      leaf = leaf.next;
    } while (leaf !== null);
  }

  *values(
    start: K = this.lowest,
    end: K = this.highest,
    inclusive: boolean = true
  ): IterableIterator<V> {
    if (this.map.size === 0) return;

    for (const key of this.keys(start, end, inclusive)) {
      const values = this.map.get(key);
      for (const value of values!) {
        yield value;
      }
    }
  }

  *entries(
    start: K = this.lowest,
    end: K = this.highest,
    inclusive: boolean = true
  ): IterableIterator<[K, V]> {
    if (this.map.size === 0) return;

    for (const key of this.keys(start, end, inclusive)) {
      const values = this.map.get(key);
      for (const value of values!) {
        yield [key, value];
      }
    }
  }

  // functional methods

  forEach(
    func: Function,
    start: K = this.lowest,
    end: K = this.highest,
    inclusive: boolean = true
  ): void {
    if (this.map.size === 0) return;

    for (const entry of this.entries(start, end, inclusive)) {
      func(entry[1], entry[0]);
    }
  }
}

class Node<K> {
  order: number;
  compare: CompareFunction<K>;
  min: number;
  max: number;
  keys: Array<K>;
  children: Array<any>;

  constructor(order: number, compare: CompareFunction<K>) {
    this.order = order;
    this.compare = compare;
    this.min = Math.ceil(order / 2) - 1;
    this.max = order - 1;
    this.keys = [];
    this.children = [];
  }

  get lowest(): K {
    return this.children[0].lowest;
  }

  get highest(): K {
    return this.children[this.children.length - 1].highest;
  }

  set(key: K): void {
    const slot = slotOf(key, this.keys, this.compare);
    const child = this.children[slot];
    if (child.keys.length > child.max) {
      let sibling;
      if (slot > 0) {
        sibling = this.children[slot - 1];
        if (sibling.keys.length < sibling.max) {
          sibling.borrowRight(child);
          this.keys[slot - 1] = child.lowest;
        } else if (slot < this.children.length - 1) {
          sibling = this.children[slot + 1];
          if (sibling.keys.length < sibling.max) {
            sibling.borrowLeft(child);
            this.keys[slot] = sibling.lowest;
          } else {
            this.splitChild(child, slot);
          }
        } else {
          this.splitChild(child, slot);
        }
      } else {
        sibling = this.children[1];
        if (sibling.keys.length < sibling.max) {
          sibling.borrowLeft(child);
          this.keys[slot] = sibling.lowest;
        } else {
          this.splitChild(child, slot);
        }
      }
    }
  }

  delete(key: K): void {
    const keys = this.keys;
    const slot = slotOf(key, keys, this.compare);
    const child = this.children[slot];
    child.delete(key);
    if (slot > 0) keys[slot - 1] = child.lowest;
    if (child.keys.length < child.min) this.consolidateChild(child, slot);
  }

  findLeaf(key: K): Leaf<K> {
    return this.children[slotOf(key, this.keys, this.compare)].findLeaf(key);
  }

  split(): Node<K> {
    const newNode = new Node<K>(this.order, this.compare);
    newNode.keys = this.keys.splice(this.min);
    newNode.keys.shift();
    newNode.children = this.children.splice(this.min + 1);
    return newNode;
  }

  shrink(): Node<K> {
    return this.children[0];
  }

  borrowLeft(source: Node<K>): void {
    this.keys.unshift(this.lowest);
    source.keys.pop();
    this.children.unshift(source.children.pop());
  }

  borrowRight(source: Node<K>): void {
    this.keys.push(source.lowest);
    source.keys.shift();
    this.children.push(source.children.shift());
  }

  merge(source: Node<K>): void {
    this.keys.push(source.lowest, ...source.keys);
    this.children.push(...source.children);
  }

  splitChild(child: Node<K> | Leaf<K>, slot: number): void {
    const newChild = child.split();
    this.keys.splice(slot, 0, newChild.lowest);
    this.children.splice(slot + 1, 0, newChild);
  }

  consolidateChild(child: Node<K> | Leaf<K>, slot: number): void {
    const keys = this.keys;
    const children = this.children;
    let sibling;
    if (slot > 0) {
      sibling = children[slot - 1];
      if (sibling.keys.length > sibling.min) {
        child.borrowLeft(sibling);
        keys[slot - 1] = child.lowest;
      } else if (slot < this.children.length - 1) {
        sibling = children[slot + 1];
        if (sibling.keys.length > sibling.min) {
          child.borrowRight(sibling);
          keys[slot] = sibling.lowest;
        } else {
          children[slot - 1].merge(child);
          keys.splice(slot - 1, 1);
          children.splice(slot, 1);
        }
      } else {
        children[slot - 1].merge(child);
        keys.splice(slot - 1, 1);
        children.splice(slot, 1);
      }
    } else {
      sibling = children[slot + 1];
      if (sibling.keys.length > sibling.min) {
        child.borrowRight(sibling);
        keys[slot] = sibling.lowest;
      } else {
        child.merge(children[1]);
        keys.splice(0, 1);
        children.splice(1, 1);
      }
    }
  }
}

class Leaf<K> {
  order: number;
  compare: CompareFunction<K>;
  min: number;
  max: number;
  keys: Array<K>;
  next: Leaf<K> | null;

  constructor(order: number, comparator: CompareFunction<K>) {
    this.order = order;
    this.compare = comparator;
    this.min = Math.ceil(order / 2);
    this.max = order;
    this.keys = [];
    this.next = null;
  }

  get lowest() {
    return this.keys[0];
  }

  get highest() {
    return this.keys[this.keys.length - 1];
  }

  set(key: K): void {
    if (this.keys.length === 0) {
      this.keys.push(key);
    } else {
      const slot = slotOf(key, this.keys, this.compare);
      this.keys.splice(slot, 0, key);
    }
  }

  delete(key: K): void {
    this.keys.splice(this.keys.indexOf(key), 1);
  }

  findLeaf(): Leaf<K> {
    return this;
  }

  split(): Leaf<K> {
    const newLeaf = new Leaf<K>(this.order, this.compare);
    newLeaf.keys = this.keys.splice(this.min);
    newLeaf.next = this.next;
    this.next = newLeaf;
    return newLeaf;
  }

  shrink(): Leaf<K> {
    return new Leaf(this.order, this.compare);
  }

  borrowLeft(source: Leaf<K>): void {
    this.keys.unshift(source.keys.pop()!);
  }

  borrowRight(source: Leaf<K>): void {
    this.keys.push(source.keys.shift()!);
  }

  merge(source: Leaf<K>): void {
    this.keys.push(...source.keys);
    this.next = source.next;
  }
}

function slotOf<K>(
  element: K,
  array: Array<K>,
  compare: CompareFunction<K>
): number {
  let bottom = 0,
    top = array.length,
    middle = top >>> 1;
  while (bottom < top) {
    const comparison = compare(element, array[middle]);
    if (comparison === 0) {
      return middle + 1;
    } else if (comparison < 0) {
      top = middle;
    } else {
      bottom = middle + 1;
    }
    middle = bottom + ((top - bottom) >>> 1);
  }
  return middle;
}
