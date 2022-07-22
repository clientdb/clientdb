---
sidebar_position: 2
---

# Creating a simple client database

The best way to quickly learn how to use clientdb would be to write some code with it.

We'll create a simple 'Todos' client database with `todo` and `list` entities.

We'll cover:

- defining entities (aka tables) of our client database
- creating a database given our defined entities
- inserting into and reading from the database
- defining relationships between entities
- defining default values for entities

## Define our first entity

The first thing we need to do is to define what type of data will your entity hold. You can think of entities like database tables.

Let's start with our Todo entity.

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
});
```

This is the minimal definition of an entity. There are way more powerful features we'll go through later.

We created a new entity definition `todoEntity` using TypeScript interface to make it type-safe.

We also provided minimal required configuration which includes `name` of the entity (aka. table name) and `fields` array which is a list of allowed fields of this entity.

:::note
You can also set `idField` when defining a new entity. If you don't define it, it will be automatically set to `id`.
:::

## Creating a data store

Now as we have our first entity, we can already create a local database with it.

```ts
import { createClientDb } from "@clientdb/core";

const db = createClientDb([todoEntity]);
```

To create a new client db, we need to pass an array of entities that will be available in it.

`db` we created will be an entry point for all the operations of our data like reading, inserting, querying, etc.

## Inserting data

Now we can add the first todo to our database.

```ts
const todo = db.add(todoEntity, {
  id: "todo-0",
  title: "Buy milk",
  doneAt: null,
});
```

Call to `db.add` returns our newly created todo. We can instantly read from it:

```ts
todo.title; // "Buy milk"
```

## Get all items from db

We can now get all todos from our database

```ts
db.entity(todoEntity).count; // count of all todos - 1

const allTodos = db.entity(todoEntity).all;
const [firstTodo] = allTodos;
firstTodo.title; // "Buy milk"
```

## Querying the database

We can also query our database with criteria of what we are looking for:

```ts
const todoQuery = db.entity(todoEntity).query({
  title: "Buy milk",
});

todoQuery.count; // 1
todoQuery.first.title; // "Buy milk"
todoQuery.all; // [todoWeCreated]
```

:::note
Query object can be way more advanced than shown in this example. Check out API reference to more informations
:::

:::info

## Your data is observable

Before we continue to other parts (eg. updating data), it'd be good to know that all of our data is observable with mobx.

This means that we can subscribe to any piece of data from the database and always have up to date results.

```ts
import { autorun } from "mobx";

autorun(() => {
  console.info(db.entity(todoEntity).count);
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

:::

## Updating entity data

Every entity can be updated by calling `entity.update()` method.

```ts
const todo = db.entity(todoEntity).findById("todo-1");

todo.doneAt; // null

const now = new Date();

// highlight-start
todo.update({
  doneAt: now,
});
// highlight-end

todo.doneAt; // now
```

## Deleting entities

Each entity can be removed with `entity.remove()` call

```ts
const todo = db.entity(todoEntity).findById("todo-1");

todo.remove();

db.entity(todoEntity).findById("todo-1"); // null
```

:::caution
Calling `.update()` on removed entity will throw an error.

You can check if the entity is removed, by calling `entity.isRemoved()`
:::

Great! We now have our database with `todo` entity. Let's move forward by creating our `list` entity and connecting it with `todo` entity.
