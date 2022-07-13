---
sidebar_position: 4
---

# Database context values

It is very common that we'll have some common values that we'll use in our database.

Such values might be:

- user id
- workspace id
- user role

Those values can be declared when creating clientdb and will be available in many places across clientdb.

Example use cases:

- `userId` field on `todo` entity that will default to current user id
- `todo.isOwnedByCurrentUser` field that will be true if todo is owned by current user

Let's write some code.

```ts
import { createDbContext, createClientDb } from "@clientdb/store";

// highlight-next-line
const userIdContext = createDbContext<string>();

const db = createClientDb([todoEntitiy, listEntity], {
  // highlight-next-line
  contexts: [userIdContext("user-a")],
});
```

Our `db` now has `userIdContext` value of `user-a`.

Let's now extend our `todoEntity` to have `isOwnedByCurrentUser` field:

```ts
interface Todo {
  id: string;
  title: string;
  doneAt: Date;
  userId: string;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt", "userId"],
}).addView((todo, { db }) => {
  return {
    // highlight-next-line
    get isOwnedByCurrentUser() {
      // highlight-next-line
      return todo.userId === db.getContextValue(userIdContext);
    },
    // ...
  };
});
```

Now we can use `isOwnedByCurrentUser` field in every todo in our database

```ts
const todo = db.entity(todoEntity).create({
  title: "Learn clientdb",
  userId: "user-a",
});

// highlight-next-line
todo.isOwnedByCurrentUser; // true

const anotherTodo = db.entity(todoEntity).create({
  title: "Learn clientdb",
  userId: "user-b",
});

// highlight-next-line
todo.isOwnedByCurrentUser; // false
```

## Using context values as default values

We can also read context values as default values for our fields.

```ts
const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt", "listId", "userId"],
  // highlight-next-line
  getDefaultValues(db) {
    return {
      // highlight-next-line
      userId: db.getContextValue(userIdContext),
    };
  },
}).addView((todo, { db }) => {
  // ...
});
```

Now, if we created todo without passing `userId` - it will default to current user id.

```ts
const todo = db.entity(todoEntity).create({
  title: "Learn clientdb",
});

todo.userId; // "user-a"
// highlight-next-line
todo.isownedByCurrentUser; // true
```

Note:
Context values are constant and has to be defined at the time of creating clientdb. If you'd like to modify context values, you'd have to create a new clientdb. We're planning to support mutable context values in the future.
