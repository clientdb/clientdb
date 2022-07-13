---
sidebar_position: 2
---

# Relationships between entities

In the previous section, we created `todo` entity.

In this section we'll create `list` entity and create relationships between `todo` and `list`:

- `todo.list` will create a reference to the corresponding list entity
- `list.todos` will return an array of todos belonging to the given list

Ok, let's start by defining `list` entity:

```ts
interface List {
  id: string;
  name: string;
}

const listEntity = defineEntity<List>({
  name: "list",
  fields: ["id", "name"],
});
```

Let's add a `listId` field to the `todo` entity we created before.

```ts
import { defineEntity } from "@clientdb/store";

interface Todo {
  id: string;
  title: string;
  doneAt: Date;
  // highlight-next-line
  listId: string;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  // highlight-next-line
  fields: ["id", "title", "doneAt", "listId"],
});
```

Great! Our entities now have all the data we need, but we still don't have relationships between them.

To do that, we'll create the so-called `view` on both our entities' definitions.

The view allows us to append custom-derived data to our entities.

## Add `todo.list` relation

We'll call `.addView` on our `todo` entity definition. This will add custom data to every `todo`.

```ts
import { defineEntity } from "@clientdb/store";

const todoEntity = defineEntity<Todo>({
  // ...
  // highlight-start
}).addView((todo, { db }) => {
  return {
    get list() {
      return db.entity(listEntity).findById(todo.listId);
    },
  };
});
// highlight-end
```

The function we passed to `addView` is called with 2 arguments:

- data of the entity (`todo`)
- helper object which includes the `db` property. `db` is the database given todo belongs to. We can use it to find other entities (todos or lists) in the same database.

Using those, we can create a `list` property getter that will try to find a `list` with an id equal to `todo.listId`.

:::info

Data passed to `addView` (`todo` variable in our case) is observable. This means that if you change the `todo.listId` property, the `list` property will be updated.

:::

:::caution

View properties should be getters. If we'd define view as:

```ts
return {
  // highlight-next-line
  list: db.entity(listEntity).findById(todo.listId),
};
```

instead of

```ts
return {
  // highlight-next-line
  get list() {
    return db.entity(listEntity).findById(todo.listId);
  },
};
```

List property would not be observable as relation will be resolved at the moment when we create entity instead of when we read `todo.list` property. Read more [in mobx guide](https://mobx.js.org/understanding-reactivity.html).

:::

## Adding `list.todos` property

Ok, now we can also add a relation to the `list` entity. It'll return an array of todos that are part of this list.

```ts
const listEntity = defineEntity<List>({
  // ...
  // highlight-start
}).addView((list, { db }) => {
  return {
    get todos() {
      return db.entity(todoEntity).query({
        listId: list.id,
      }).all;
    },
  };
});
// highlight-end
```

Our relations are ready.

The last thing we need to do is update our database to be aware of our new `listEntity` entity

```ts
import { createClientDb } from "@clientdb/store";

// highlight-next-line
const db = createClientDb([todoEntity, listEntity]);
```

---

We're ready to go.

Now let's populate our database with some todos and lists.

```ts
const list = db.add(listEntity, {
  id: "list-1",
  name: "Groceries",
});

const todo1 = db.add(todoEntity, {
  id: "todo-1",
  title: "Buy milk",
  doneAt: null,
  listId: list.id,
});

const todo2 = db.add(todoEntity, {
  id: "todo-2",
  title: "Buy books",
  doneAt: null,
  listId: list.id,
});
```

Let's read data using newly created relations:

```ts
list.todos; // [todo1, todo2]
todo1.list.name; // "Groceries"
todo1.list === todo2.list; // true
```

## Recap

Full code so far would be:

```ts
import { createClientDb } from "@clientdb/store";
import { defineEntity } from "@clientdb/store";

interface Todo {
  id: string;
  title: string;
  doneAt: Date;
  listId: string;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt", "listId"],
}).addView((todo, { db }) => {
  return {
    get list() {
      return db.entity(listEntity).findById(todo.listId);
    },
  };
});

interface List {
  id: string;
  name: string;
}

const listEntity = defineEntity<List>({
  name: "list",
  fields: ["id", "name"],
}).addView((list, { db }) => {
  return {
    get todos() {
      return db.entity(todoEntity).query({
        listId: list.id,
      }).all;
    },
  };
});

const db = createClientDb([todoEntity, listEntity]);
```
