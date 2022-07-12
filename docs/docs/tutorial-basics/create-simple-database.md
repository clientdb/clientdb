---
sidebar_position: 2
---

# Creating simple client database

## Define our first entity

First thing we need to do is to define what type of data will your entity hold. You can think of entities like database tables.

Let's start with our Todo entity.

```ts
import { defineEntity } from "@clientdb/store";

interface Todo {
  id: string;
  title: string;
  doneAt: Date;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
  fields: ["id", "title", "doneAt"],
});
```

This is the minimal definition of an entity. There are way more powerful features we'll go trough later.

In the previous example we defined data interface of the `Todo` entity. These were the `name` of the entity (which should usually be the same as the table's name), the `idField` that is used to point to id of the entity, and what `fields` are allowed (should list all fields of your data interface).

Note: You can also set `idField` when defining new entity. If you don't define it, it will be automatically set to `id`.

## Creating a data store

Now as we have our first entity, we can already create local database with it.

```ts
import { createClientDb } from "@clientdb/store";

const db = createClientDb([todoEntity]);
```

To create db, we need to pass array of entities that will be avaliable in it.

## Creating new entities

Now we can add first todo to our database.

```ts
const todo = db.add(todoEntity, {
  id: "todo-0",
  title: "Buy milk",
  doneAt: null,
});
```

`db.add` return our newly created todo. We can instantly read from it:

```ts
todo.title; // "Buy milk"
```

We can now get our todo directly from database:

```ts
db.entity(todoEntity).count; // count of all todos - 1

const allTodos = db.entity(todoEntity).all;
const [firstTodo] = allTodos;
firstTodo.title; // "Buy milk"
```

We can also query our database:

```ts
const todoQuery = db.entity(todoEntity).query({
  title: "Buy milk",
});

todoQuery.count; // 1
todoQuery.first.title; // "Buy milk"
todoQuery.all; // [todoWeCreated]
```

## Your data is observable

Before we continue to other parts (eg. updating data), it'd be good to know that all of our data is observable with mobx.

This means that we can subscribe to any piece of data from the database and always have up to date results.

```ts
import { autorun } from "mobx";

autorun(() => {
  console.log(db.entity(todoEntity).count);
});

db.add(todoEntity, {
  id: "todo-1",
  title: "Buy milk",
  doneAt: null,
});

db.add(todoEntity, {
  id: "todo-2",
  title: "Buy books",
  doneAt: null,
});

// prints:
// 0
// 1
// 2
```

## Updating entity data

Every entity can be updated with `.update` method.

```ts
const todo = db.entity(todoEntity).findById("todo-1");

todo.doneAt; // null

const now = new Date();

todo.update({
  doneAt: now,
});

todo.doneAt; // now
```

## Deleting entities

Each entity can be removed with `.remove` method

```ts
const todo = db.entity(todoEntity).findById("todo-1");

todo.remove();

db.entity(todoEntity).findById("todo-1"); // null
```

Great! We now have our database with `todo` entity. Let's move forward by creating our `list` entity and connecting it with `todo` entity.
