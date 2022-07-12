# Guide

The best way to quickly learn how to use clientdb would be to write some code with it.

We'll create a simple 'Todos' client database with `todo` and `list` entities.

We'll cover:

- defining entities (aka tables) of our client database
- creating a database given our defined entities
- inserting into and reading from the database
- defining relationships between entities
- defining default values for entities

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

# Relationships between entities

Our database now has one entity called `todo`. Let's create `list` entity and add relationships between `todo` and `list`.

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
  listId: string;
}

const todoEntity = defineEntity<Todo>({
  name: "todo",
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
  list: db.entity(listEntity).findById(todo.listId),
};
```

instead of

```ts
return {
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

## Creating default values for entities

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
  getDefaultValues() {
    return {
      id: generateId(),
      doneAt: null,
    };
  },
}).addView((todo, { db }) => {
  // ...
});
```

Now we can also include default id to `list` entity

```ts
const listEntity = defineEntity<List>({
  name: "list",
  fields: ["id", "name"],
  getDefaultValues() {
    return {
      id: generateId(),
    };
  },
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
