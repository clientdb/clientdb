---
sidebar_position: 3
---

# Creating default values for entities

So far we had to manually set all the values of our entities when inserting them, eg:

```ts
const todo = db.add(todoEntity, {
  id: "todo-1",
  title: "Buy milk",
  doneAt: null,
  listId: list.id,
});
```

In this case, both `id` and `doneAt` could have some default values. `id` would be some auto-generated string, and `doneAt` could be `null` by default.

Let's modify our todo entity:

```ts
/**
 * Some simple function to generate random id. Could be uuid or anything similar as well
 */
function generateId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt", "listId"],
  // highlight-start
  getDefaultValues() {
    return {
      id: generateId(),
      doneAt: null,
    };
  },
  // highlight-end
}).addView((todo, { db }) => {
  // ...
});
```

Now we can also include default id to `list` entity

```ts
const listEntity = defineEntity<List>({
  name: "list",
  fields: ["id", "name"],
  // highlight-start
  getDefaultValues() {
    return {
      id: generateId(),
    };
  },
  // highlight-end
}).addView((list, { db }) => {
  // ...
});
```

With that, we can create new entities without manually setting `id` for both list and todo or `doneAt` for todos:

```ts
const list = db.add(listEntity, {
  name: "Groceries",
});

list.id; // "89qnxvnt57"

const todo = db.add(todoEntity, {
  title: "Buy milk",
  listId: list.id,
});

todo.id; // "jemsfhysjk"
todo.list.name; // "Groceries"
```
