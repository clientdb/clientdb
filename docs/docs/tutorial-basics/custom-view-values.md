---
sidebar_position: 4
---

# Enhance entity view

In the previous section, we created a view that allows us to resolve relations between entities.

The view can also be used to define any custom values that will be available in our entities.

Let's define `isDone` field that will be a boolean value based on weather `doneAt` is null or not.

```ts
import { defineEntity } from "@clientdb/core";

interface Todo {
  id: string;
  title: string;
  doneAt: Date;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt"],
}).addView((todo, { db }) => {
  return {
    // highlight-next-line
    get isDone() {
      return todo.doneAt !== null;
    },
    // ...
  };
});
```

Now we can use the `isDone` field in every todo in our database

```ts
const todo = db.entity(todoEntity).create({
  title: "Learn clientdb",
});

// highlight-next-line
todo.isDone; // false

todo.update({ doneAt: new Date() });

// highlight-next-line
todo.isDone; // true
```

## Using custom fields to query the database

All custom fields are available when we query our database.

```ts
const completedTodosQuery = db.entity(todoEntity).query({
  // highlight-next-line
  isDone: true,
});

const unfinishedTodosQuery = db.entity(todoEntity).query({
  // highlight-next-line
  isDone: false,
});

const todo = db.entity(todoEntity).create({
  title: "Learn clientdb",
});

completedTodosQuery.count; // 0
completedTodosQuery.all; // []
unfinishedTodosQuery.count; // 1
unfinishedTodosQuery.all; // [todo]

todo.update({ doneAt: new Date() });

completedTodosQuery.count; // 1
completedTodosQuery.all; // [todo]
unfinishedTodosQuery.count; // 0
unfinishedTodosQuery.all; // []
```

Note: queries are indexed by clientdb under the hood, so your queries will be very fast, even with 1000s of items in your database.

## Creating custom 'methods' in your view

The view can define derived data like `isDone`, but it can also include custom methods like `markAsDone`

```ts
import { defineEntity } from "@clientdb/core";

interface Todo {
  id: string;
  title: string;
  doneAt: Date;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt"],
  // highlight-next-line
}).addView((todo, { db, updateSelf }) => {
  return {
    get isDone() {
      return todo.doneAt !== null;
    },
    // highlight-next-line
    markAsDone() {
      // highlight-next-line
      updateSelf({ doneAt: new Date() });
    },
    // highlight-next-line
    markAsNotDone() {
      // highlight-next-line
      updateSelf({ doneAt: null });
    },
    // ...
  };
});
```

We now used another utility passed to `addView` called `updateSelf` that allows us to update our entity in the database.

We can now use those methods on any todo in our database

```ts
const todo = db.entity(todoEntity).create({
  title: "Learn clientdb",
});

todo.isDone; // false
// highlight-next-line
todo.markAsDone();
todo.isDone; // true
```
