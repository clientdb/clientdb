/**
 * Context of clientdb is very similar concept to React context.
 *
 * Very often we want to pass some information to clientdb that can be used deeply inside entities.
 *
 * For example we might want entity 'topic' with 'isOwn' method which will tell if topic belongs to current user.
 *
 * To do this, we create 'db' context that can be used in various places in the app.
 */

export interface DbContextInstance<T> {
  value: T;
  context: DbContext<T>;
}

export interface DbContext<T> {
  create(value: T): DbContextInstance<T>;
}

export function createDbContext<T>(): DbContext<T> {
  const dbContext: DbContext<T> = {
    create(value) {
      return { value, context: dbContext };
    },
  };

  return dbContext;
}
