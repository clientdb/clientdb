/**
 * Define your data shape
 *
 * Your entire database is reflected on client-side. You can create client-side entities in type-safe way.
 */

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

/**
 * Create in-memory database
 *
 * When your entities are ready, create client side database and start using it.
 */

import { createClientDb } from "@clientdb/store";

const db = createClientDb([todoEntity]);

/**
 * Insert and modify data
 *
 * All write operations happen in memory and are instantly reflected in the UI
 */

const todo = db.add(todoEntity, {
  title: "Buy milk",
});

todo.update({ doneAt: new Date() });
todo.remove();

/**
 * Query database with instant results
 *
 * Clientdb includes powerful and well-optimized query engine, which allows you to find any data without waiting for the server
 */

db.entity(todoEntity).query({
  title: "Buy milk",
}).all;

/**
 * Create relationships between entities
 *
 * All relations between entities are also resolved in-memory. No matter what change you make, all data will be instantly properly reflected in the UI
 */

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
      return db.entity(todoEntity).query({ listId: list.id }).all;
    },
  };
});

db.entity(listEntity).first.todos;
