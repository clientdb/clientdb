import SortedSet, { Node as SetNode } from "collections/sorted-set";
import { IObservableArray, observable } from "mobx";

function compareValues<T>(a: T, b: T) {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

type IndexPage<T> = IObservableArray<T>;

export function createValuesIndex<Value, Item>(
  valueGetter: (item: Item) => Value
) {
  type Page = IndexPage<Item>;

  const pageKeys = new SortedSet<Value>([], undefined, compareValues);
  const pagesMap = new Map<Value, Page>();
  const currentItemPage = new Map<Item, Page>();

  function createPage(value: Value): Page {
    pageKeys.add(value);
    return observable.array();
  }

  function getValuePage(value: Value) {
    let items = pagesMap.get(value);

    if (!items) {
      items = createPage(value);
      pagesMap.set(value, items);
    }

    return items;
  }

  function remove(item: Item) {
    currentItemPage.get(item)?.remove(item);
    currentItemPage.delete(item);
  }

  function updateItemPage(item: Item, page: Page) {
    const currentPage = currentItemPage.get(item);

    if (currentPage === page) return;

    if (currentPage) {
      currentPage.remove(item);
    }

    page.push(item);
    currentItemPage.set(item, page);
  }

  function update(item: Item) {
    const value = valueGetter(item);

    const targetPage = getValuePage(value);

    updateItemPage(item, targetPage);
  }

  function getEqual(value: Value) {
    return pagesMap.get(value);
  }

  function getNotEqual(value: Value) {
    const equalPage = pagesMap.get(value);

    const pages = pagesMap.values();
    const results: Item[] = [];

    for (const page of pages) {
      if (page === equalPage) continue;

      for (const item of page) {
        results.push(item);
      }
    }

    return results;
  }

  function collectResults(
    startNode: SetNode<Value> | undefined,
    direction: 1 | -1
  ) {
    let nextNode = startNode;

    if (!nextNode) return [];

    const results: Item[] = [];

    while (nextNode) {
      const items = pagesMap.get(nextNode.value)!;

      for (const item of items) {
        results.push(item);
      }

      if (direction === 1) {
        nextNode = nextNode.getNext();
      } else {
        nextNode = nextNode.getPrevious();
      }
    }

    return results;
  }

  function getGreaterThan(value: Value) {
    return collectResults(pageKeys.findLeastGreaterThan(value), 1);
  }

  function getGreaterOrEqual(value: Value) {
    return collectResults(pageKeys.findLeastGreaterThanOrEqual(value), 1);
  }

  function getLesserThan(value: Value) {
    return collectResults(pageKeys.findGreatestLessThan(value), -1);
  }

  function getLesserOrEqualThan(value: Value) {
    return collectResults(pageKeys.findGreatestLessThanOrEqual(value), -1);
  }

  return {
    update,
    remove,
    getEqual,
    getNotEqual,
    getGreaterThan,
    getGreaterOrEqual,
    getLesserThan,
    getLesserOrEqualThan,
  };
}
