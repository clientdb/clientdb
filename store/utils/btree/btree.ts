// B+ tree by David Piepgrass. License: MIT
import { defaultComparator } from "./compare";
import { iterator } from "./iterator";
import { BNode, BNodeInternal } from "./node";

export type EditRangeResult<V, R = number> = {
  value?: V;
  break?: R;
  delete?: boolean;
};

export default class BTree<K = any, V = any> {
  private _root: BNode<K, V> = EmptyLeaf as BNode<K, V>;
  _size: number = 0;
  _maxNodeSize: number;

  /**
   * provides a total order over keys (and a strict partial order over the type K)
   * @returns a negative value if a < b, 0 if a === b and a positive value if a > b
   */
  _compare: (a: K, b: K) => number;

  /**
   * Initializes an empty B+ tree.
   * @param compare Custom function to compare pairs of elements in the tree.
   *   If not specified, defaultComparator will be used which is valid as long as K extends DefaultComparable.
   * @param entries A set of key-value pairs to initialize the tree
   * @param maxNodeSize Branching factor (maximum items or children per node)
   *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
   */
  public constructor(
    entries?: [K, V][],
    compare?: (a: K, b: K) => number,
    maxNodeSize?: number
  ) {
    this._maxNodeSize = maxNodeSize! >= 4 ? Math.min(maxNodeSize!, 256) : 32;
    this._compare =
      compare || (defaultComparator as any as (a: K, b: K) => number);
    if (entries) this.setPairs(entries);
  }

  /////////////////////////////////////////////////////////////////////////////
  // ES6 Map<K,V> methods /////////////////////////////////////////////////////

  /** Gets the number of key-value pairs in the tree. */
  get size() {
    return this._size;
  }
  /** Gets the number of key-value pairs in the tree. */
  get length() {
    return this._size;
  }
  /** Returns true iff the tree contains no key-value pairs. */
  get isEmpty() {
    return this._size === 0;
  }

  /** Releases the tree so that its size is 0. */
  clear() {
    this._root = EmptyLeaf as BNode<K, V>;
    this._size = 0;
  }

  /**
   * Finds a pair in the tree and returns the associated value.
   * @param defaultValue a value to return if the key was not found.
   * @returns the value, or defaultValue if the key was not found.
   * @description Computational complexity: O(log size)
   */
  get(key: K, defaultValue?: V): V | undefined {
    return this._root.get(key, defaultValue, this);
  }

  /**
   * Adds or overwrites a key-value pair in the B+ tree.
   * @param key the key is used to determine the sort order of
   *        data in the tree.
   * @param value data to associate with the key (optional)
   * @param overwrite Whether to overwrite an existing key-value pair
   *        (default: true). If this is false and there is an existing
   *        key-value pair then this method has no effect.
   * @returns true if a new key-value pair was added.
   * @description Computational complexity: O(log size)
   * Note: when overwriting a previous entry, the key is updated
   * as well as the value. This has no effect unless the new key
   * has data that does not affect its sort order.
   */
  set(key: K, value: V, overwrite?: boolean): boolean {
    var result = this._root.set(key, value, overwrite, this);
    if (result === true || result === false) return result;
    // Root node has split, so create a new root node.
    this._root = new BNodeInternal<K, V>([this._root, result]);
    return true;
  }

  /**
   * Returns true if the key exists in the B+ tree, false if not.
   * Use get() for best performance; use has() if you need to
   * distinguish between "undefined value" and "key not present".
   * @param key Key to detect
   * @description Computational complexity: O(log size)
   */
  has(key: K): boolean {
    return this.forRange(key, key, true, undefined) !== 0;
  }

  /**
   * Removes a single key-value pair from the B+ tree.
   * @param key Key to find
   * @returns true if a pair was found and removed, false otherwise.
   * @description Computational complexity: O(log size)
   */
  delete(key: K): boolean {
    return this.editRange(key, key, true, DeleteRange) !== 0;
  }

  iterator(
    lowestKey?: K,
    highestKey?: K,
    reusedArray?: (K | V)[]
  ): IterableIterator<[K, V]> {
    const info = this.findPath(lowestKey);
    if (info === undefined) return iterator<[K, V]>();
    let { nodequeue, nodeindex, leaf } = info;
    let state = reusedArray !== undefined ? 1 : 0;
    let i =
      lowestKey === undefined
        ? -1
        : leaf.indexOf(lowestKey, 0, this._compare) - 1;

    return iterator<[K, V]>(() => {
      jump: for (;;) {
        switch (state) {
          case 0:
            if (++i < leaf.keys.length) {
              return { done: false, value: [leaf.keys[i], leaf.values[i]] };
            }
            state = 2;
            continue;
          case 1:
            if (++i < leaf.keys.length) {
              (reusedArray![0] = leaf.keys[i]),
                (reusedArray![1] = leaf.values[i]);
              return { done: false, value: reusedArray as [K, V] };
            }
            state = 2;
          case 2:
            // Advance to the next leaf node
            for (var level = -1; ; ) {
              if (++level >= nodequeue.length) {
                state = 3;
                continue jump;
              }
              if (++nodeindex[level] < nodequeue[level].length) break;
            }
            for (; level > 0; level--) {
              nodequeue[level - 1] = (
                nodequeue[level][nodeindex[level]] as BNodeInternal<K, V>
              ).children;
              nodeindex[level - 1] = 0;
            }
            leaf = nodequeue[0][nodeindex[0]];
            i = -1;
            state = reusedArray !== undefined ? 1 : 0;
            continue;
          case 3:
            return { done: true, value: undefined };
        }
      }
    });
  }

  /** Returns an iterator that provides items in order (ascending order if
   *  the collection's comparator uses ascending order, as is the default.)
   *  @param lowestKey First key to be iterated, or undefined to start at
   *         minKey(). If the specified key doesn't exist then iteration
   *         starts at the next higher key (according to the comparator).
   *  @param reusedArray Optional array used repeatedly to store key-value
   *         pairs, to avoid creating a new array on every iteration.
   */
  entries(lowestKey?: K, reusedArray?: (K | V)[]): IterableIterator<[K, V]> {
    var info = this.findPath(lowestKey);
    if (info === undefined) return iterator<[K, V]>();
    var { nodequeue, nodeindex, leaf } = info;
    var state = reusedArray !== undefined ? 1 : 0;
    var i =
      lowestKey === undefined
        ? -1
        : leaf.indexOf(lowestKey, 0, this._compare) - 1;

    return iterator<[K, V]>(() => {
      jump: for (;;) {
        switch (state) {
          case 0:
            if (++i < leaf.keys.length)
              return { done: false, value: [leaf.keys[i], leaf.values[i]] };
            state = 2;
            continue;
          case 1:
            if (++i < leaf.keys.length) {
              (reusedArray![0] = leaf.keys[i]),
                (reusedArray![1] = leaf.values[i]);
              return { done: false, value: reusedArray as [K, V] };
            }
            state = 2;
          case 2:
            // Advance to the next leaf node
            for (var level = -1; ; ) {
              if (++level >= nodequeue.length) {
                state = 3;
                continue jump;
              }
              if (++nodeindex[level] < nodequeue[level].length) break;
            }
            for (; level > 0; level--) {
              nodequeue[level - 1] = (
                nodequeue[level][nodeindex[level]] as BNodeInternal<K, V>
              ).children;
              nodeindex[level - 1] = 0;
            }
            leaf = nodequeue[0][nodeindex[0]];
            i = -1;
            state = reusedArray !== undefined ? 1 : 0;
            continue;
          case 3:
            return { done: true, value: undefined };
        }
      }
    });
  }

  /** Returns an iterator that provides items in reversed order.
   *  @param highestKey Key at which to start iterating, or undefined to
   *         start at maxKey(). If the specified key doesn't exist then iteration
   *         starts at the next lower key (according to the comparator).
   *  @param reusedArray Optional array used repeatedly to store key-value
   *         pairs, to avoid creating a new array on every iteration.
   *  @param skipHighest Iff this flag is true and the highestKey exists in the
   *         collection, the pair matching highestKey is skipped, not iterated.
   */
  entriesReversed(
    highestKey?: K,
    reusedArray?: (K | V)[],
    skipHighest?: boolean
  ): IterableIterator<[K, V]> {
    if (highestKey === undefined) {
      highestKey = this.maxKey;
      skipHighest = undefined;
      if (highestKey === undefined) return iterator<[K, V]>(); // collection is empty
    }
    var { nodequeue, nodeindex, leaf } =
      this.findPath(highestKey) || this.findPath(this.maxKey)!;
    check(!nodequeue[0] || leaf === nodequeue[0][nodeindex[0]], "wat!");
    var i = leaf.indexOf(highestKey, 0, this._compare);
    if (
      !skipHighest &&
      i < leaf.keys.length &&
      this._compare(leaf.keys[i], highestKey) <= 0
    )
      i++;
    var state = reusedArray !== undefined ? 1 : 0;

    return iterator<[K, V]>(() => {
      jump: for (;;) {
        switch (state) {
          case 0:
            if (--i >= 0)
              return { done: false, value: [leaf.keys[i], leaf.values[i]] };
            state = 2;
            continue;
          case 1:
            if (--i >= 0) {
              (reusedArray![0] = leaf.keys[i]),
                (reusedArray![1] = leaf.values[i]);
              return { done: false, value: reusedArray as [K, V] };
            }
            state = 2;
          case 2:
            // Advance to the next leaf node
            for (var level = -1; ; ) {
              if (++level >= nodequeue.length) {
                state = 3;
                continue jump;
              }
              if (--nodeindex[level] >= 0) break;
            }
            for (; level > 0; level--) {
              nodequeue[level - 1] = (
                nodequeue[level][nodeindex[level]] as BNodeInternal<K, V>
              ).children;
              nodeindex[level - 1] = nodequeue[level - 1].length - 1;
            }
            leaf = nodequeue[0][nodeindex[0]];
            i = leaf.keys.length;
            state = reusedArray !== undefined ? 1 : 0;
            continue;
          case 3:
            return { done: true, value: undefined };
        }
      }
    });
  }

  /* Used by entries() and entriesReversed() to prepare to start iterating.
   * It develops a "node queue" for each non-leaf level of the tree.
   * Levels are numbered "bottom-up" so that level 0 is a list of leaf
   * nodes from a low-level non-leaf node. The queue at a given level L
   * consists of nodequeue[L] which is the children of a BNodeInternal,
   * and nodeindex[L], the current index within that child list, such
   * such that nodequeue[L-1] === nodequeue[L][nodeindex[L]].children.
   * (However inside this function the order is reversed.)
   */
  private findPath(
    key?: K
  ):
    | { nodequeue: BNode<K, V>[][]; nodeindex: number[]; leaf: BNode<K, V> }
    | undefined {
    var nextnode = this._root;
    var nodequeue: BNode<K, V>[][], nodeindex: number[];

    if (nextnode.isLeaf) {
      (nodequeue = EmptyArray), (nodeindex = EmptyArray); // avoid allocations
    } else {
      (nodequeue = []), (nodeindex = []);
      for (var d = 0; !nextnode.isLeaf; d++) {
        nodequeue[d] = (nextnode as BNodeInternal<K, V>).children;
        nodeindex[d] =
          key === undefined ? 0 : nextnode.indexOf(key, 0, this._compare);
        if (nodeindex[d] >= nodequeue[d].length) return; // first key > maxKey()
        nextnode = nodequeue[d][nodeindex[d]];
      }
      nodequeue.reverse();
      nodeindex.reverse();
    }
    return { nodequeue, nodeindex, leaf: nextnode };
  }

  /** Returns a new iterator for iterating the keys of each pair in ascending order.
   *  @param firstKey: Minimum key to include in the output. */
  keys(firstKey?: K): IterableIterator<K> {
    var it = this.entries(firstKey, ReusedArray);
    return iterator<K>(() => {
      var n: IteratorResult<any> = it.next();
      if (n.value) n.value = n.value[0];
      return n;
    });
  }

  /** Returns a new iterator for iterating the values of each pair in order by key.
   *  @param firstKey: Minimum key whose associated value is included in the output. */
  values(firstKey?: K): IterableIterator<V> {
    var it = this.entries(firstKey, ReusedArray);
    return iterator<V>(() => {
      var n: IteratorResult<any> = it.next();
      if (n.value) n.value = n.value[1];
      return n;
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // Additional methods ///////////////////////////////////////////////////////

  /** Returns the maximum number of children/values before nodes will split. */
  get maxNodeSize() {
    return this._maxNodeSize;
  }

  /** Gets the lowest key in the tree. Complexity: O(log size) */
  get minKey(): K | undefined {
    return this._root.minKey;
  }

  /** Gets the highest key in the tree. Complexity: O(1) */
  get maxKey(): K | undefined {
    return this._root.maxKey;
  }

  /** Returns the next pair whose key is larger than the specified key (or undefined if there is none).
   * If key === undefined, this function returns the lowest pair.
   * @param key The key to search for.
   * @param reusedArray Optional array used repeatedly to store key-value pairs, to
   * avoid creating a new array on every iteration.
   */
  nextHigherPair(key: K | undefined, reusedArray?: [K, V]): [K, V] | undefined {
    reusedArray = reusedArray || ([] as unknown as [K, V]);
    if (key === undefined) {
      return this._root.minPair(reusedArray);
    }
    return this._root.getPairOrNextHigher(
      key,
      this._compare,
      false,
      reusedArray
    );
  }

  /** Returns the next key larger than the specified key, or undefined if there is none.
   *  Also, nextHigherKey(undefined) returns the lowest key.
   */
  nextHigherKey(key: K | undefined): K | undefined {
    var p = this.nextHigherPair(key, ReusedArray as [K, V]);
    return p && p[0];
  }

  /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none).
   *  If key === undefined, this function returns the highest pair.
   * @param key The key to search for.
   * @param reusedArray Optional array used repeatedly to store key-value pairs, to
   *        avoid creating a new array each time you call this method.
   */
  nextLowerPair(key: K | undefined, reusedArray?: [K, V]): [K, V] | undefined {
    reusedArray = reusedArray || ([] as unknown as [K, V]);
    if (key === undefined) {
      return this._root.maxPair(reusedArray);
    }
    return this._root.getPairOrNextLower(
      key,
      this._compare,
      false,
      reusedArray
    );
  }

  /** Returns the next key smaller than the specified key, or undefined if there is none.
   *  Also, nextLowerKey(undefined) returns the highest key.
   */
  nextLowerKey(key: K | undefined): K | undefined {
    var p = this.nextLowerPair(key, ReusedArray as [K, V]);
    return p && p[0];
  }

  /** Returns the key-value pair associated with the supplied key if it exists
   *  or the pair associated with the next lower pair otherwise. If there is no
   *  next lower pair, undefined is returned.
   * @param key The key to search for.
   * @param reusedArray Optional array used repeatedly to store key-value pairs, to
   *        avoid creating a new array each time you call this method.
   * */
  getPairOrNextLower(key: K, reusedArray?: [K, V]): [K, V] | undefined {
    return this._root.getPairOrNextLower(
      key,
      this._compare,
      true,
      reusedArray || ([] as unknown as [K, V])
    );
  }

  /** Returns the key-value pair associated with the supplied key if it exists
   *  or the pair associated with the next lower pair otherwise. If there is no
   *  next lower pair, undefined is returned.
   * @param key The key to search for.
   * @param reusedArray Optional array used repeatedly to store key-value pairs, to
   *        avoid creating a new array each time you call this method.
   * */
  getPairOrNextHigher(key: K, reusedArray?: [K, V]): [K, V] | undefined {
    return this._root.getPairOrNextHigher(
      key,
      this._compare,
      true,
      reusedArray || ([] as unknown as [K, V])
    );
  }

  /** Edits the value associated with a key in the tree, if it already exists.
   * @returns true if the key existed, false if not.
   */
  changeIfPresent(key: K, value: V): boolean {
    return this.editRange(key, key, true, () => ({ value })) !== 0;
  }

  /**
   * Builds an array of pairs from the specified range of keys, sorted by key.
   * Each returned pair is also an array: pair[0] is the key, pair[1] is the value.
   * @param low The first key in the array will be greater than or equal to `low`.
   * @param high This method returns when a key larger than this is reached.
   * @param includeHigh If the `high` key is present, its pair will be included
   *        in the output if and only if this parameter is true. Note: if the
   *        `low` key is present, it is always included in the output.
   * @param maxLength Length limit. getRange will stop scanning the tree when
   *                  the array reaches this size.
   * @description Computational complexity: O(result.length + log size)
   */
  getRange(
    low: K,
    high: K,
    includeHigh?: boolean,
    maxLength: number = 0x3ffffff
  ): [K, V][] {
    var results: [K, V][] = [];
    this._root.forRange(low, high, includeHigh, false, this, 0, (k, v) => {
      results.push([k, v]);
      return results.length > maxLength ? Break : undefined;
    });
    return results;
  }

  /** Adds all pairs from a list of key-value pairs.
   * @param pairs Pairs to add to this tree. If there are duplicate keys,
   *        later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]]
   *        associates 0 with 7.)
   * @param overwrite Whether to overwrite pairs that already exist (if false,
   *        pairs[i] is ignored when the key pairs[i][0] already exists.)
   * @returns The number of pairs added to the collection.
   * @description Computational complexity: O(pairs.length * log(size + pairs.length))
   */
  setPairs(pairs: [K, V][], overwrite?: boolean): number {
    var added = 0;
    for (var i = 0; i < pairs.length; i++)
      if (this.set(pairs[i][0], pairs[i][1], overwrite)) added++;
    return added;
  }

  forRange(
    low: K,
    high: K,
    includeHigh: boolean,
    onFound?: (k: K, v: V, counter: number) => void,
    initialCounter?: number
  ): number;

  /**
   * Scans the specified range of keys, in ascending order by key.
   * Note: the callback `onFound` must not insert or remove items in the
   * collection. Doing so may cause incorrect data to be sent to the
   * callback afterward.
   * @param low The first key scanned will be greater than or equal to `low`.
   * @param high Scanning stops when a key larger than this is reached.
   * @param includeHigh If the `high` key is present, `onFound` is called for
   *        that final pair if and only if this parameter is true.
   * @param onFound A function that is called for each key-value pair. This
   *        function can return {break:R} to stop early with result R.
   * @param initialCounter Initial third argument of onFound. This value
   *        increases by one each time `onFound` is called. Default: 0
   * @returns The number of values found, or R if the callback returned
   *        `{break:R}` to stop early.
   * @description Computational complexity: O(number of items scanned + log size)
   */
  forRange<R = number>(
    low: K,
    high: K,
    includeHigh: boolean,
    onFound?: (k: K, v: V, counter: number) => { break?: R } | void,
    initialCounter?: number
  ): R | number {
    var r = this._root.forRange(
      low,
      high,
      includeHigh,
      false,
      this,
      initialCounter || 0,
      onFound
    );
    return typeof r === "number" ? r : r.break!;
  }

  /**
   * Scans and potentially modifies values for a subsequence of keys.
   * Note: the callback `onFound` should ideally be a pure function.
   *   Specfically, it must not insert items, call clone(), or change
   *   the collection except via return value; out-of-band editing may
   *   cause an exception or may cause incorrect data to be sent to
   *   the callback (duplicate or missed items). It must not cause a
   *   clone() of the collection, otherwise the clone could be modified
   *   by changes requested by the callback.
   * @param low The first key scanned will be greater than or equal to `low`.
   * @param high Scanning stops when a key larger than this is reached.
   * @param includeHigh If the `high` key is present, `onFound` is called for
   *        that final pair if and only if this parameter is true.
   * @param onFound A function that is called for each key-value pair. This
   *        function can return `{value:v}` to change the value associated
   *        with the current key, `{delete:true}` to delete the current pair,
   *        `{break:R}` to stop early with result R, or it can return nothing
   *        (undefined or {}) to cause no effect and continue iterating.
   *        `{break:R}` can be combined with one of the other two commands.
   *        The third argument `counter` is the number of items iterated
   *        previously; it equals 0 when `onFound` is called the first time.
   * @returns The number of values scanned, or R if the callback returned
   *        `{break:R}` to stop early.
   * @description
   *   Computational complexity: O(number of items scanned + log size)
   *   Note: if the tree has been cloned with clone(), any shared
   *   nodes are copied before `onFound` is called. This takes O(n) time
   *   where n is proportional to the amount of shared data scanned.
   */
  editRange<R = V>(
    low: K,
    high: K,
    includeHigh: boolean,
    onFound: (k: K, v: V, counter: number) => EditRangeResult<V, R> | void,
    initialCounter?: number
  ): R | number {
    var root = this._root;
    try {
      var r = root.forRange(
        low,
        high,
        includeHigh,
        true,
        this,
        initialCounter || 0,
        onFound
      );
      return typeof r === "number" ? r : r.break!;
    } finally {
      while (root.keys.length <= 1 && !root.isLeaf) {
        this._root = root =
          root.keys.length === 0
            ? EmptyLeaf
            : (root as any as BNodeInternal<K, V>).children[0];
      }
    }
  }

  /** Gets the height of the tree: the number of internal nodes between the
   *  BTree object and its leaf nodes (zero if there are no internal nodes). */
  get height(): number {
    let node: BNode<K, V> | undefined = this._root;
    let height = -1;
    while (node) {
      height++;
      node = node.isLeaf
        ? undefined
        : (node as unknown as BNodeInternal<K, V>).children[0];
    }
    return height;
  }
}

const Delete = { delete: true },
  DeleteRange = () => Delete;
const Break = { break: true };
const EmptyLeaf = (function () {
  var n = new BNode<any, any>();
  return n;
})();
const EmptyArray: any[] = [];
const ReusedArray: any[] = []; // assumed thread-local

function check(fact: boolean, ...args: any[]) {
  if (!fact) {
    args.unshift("B+ tree"); // at beginning of message
    throw new Error(args.join(" "));
  }
}
