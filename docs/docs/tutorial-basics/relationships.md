---
sidebar_position: 2
---

# Relationships between entities

Our database now has one entity called `todo`.

Let's create `list` entity and add relationships between `todo` and `list`.

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

List entity is ready, but there is no relation between todo and list.

Let's add `listId` field to todo entity we created before.

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

We can add it now creating so-called `view` to our entities definitions.

View simply allows us to append custom derieved data to our entities.

## Add `todo.list` relation

We'll call `.addView` on our `todo` entity definition explaining it how to find corresponding list.

```ts
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
  // highlight-next-line
}).addView((todo, { db }) => {
  return {
    get list() {
      return db.entity(listEntity).findById(todo.listId);
    },
  };
});
```

Function we passed to `addView` is called with 2 arguments:

- data object of the entity
- object which includes 'db' property which is database given todo is part of. We can use it to find other entities than todo's in the same database.

Using those, we can create `list` property that will try to find list entity with id equal to `todo.listId`.

### Important note

Data passed to `addView` (`todo` variable in our case) is observable. This means that if you change `todo.listId` property, `list` property will be updated.

### Another important note

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

---

Ok, now we can also add relation to list entity. It'll be `list.todos` property that will return array of todos that are part of this list.

```ts
const listEntity = defineEntity<List>({
  name: "list",
  fields: ["id", "name"],
  // highlight-next-line
}).addView((list, { db }) => {
  return {
    get todos() {
      return db.entity(todoEntity).query({
        listId: list.id,
      }).all;
    },
  };
});
```

Our relations are ready.

Last thing we need to do is update our database to be aware of our new entity

```ts
import { createClientDb } from "@clientdb/store";

// highlight-next-line
const db = createClientDb([todoEntity, listEntity]);
```

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
