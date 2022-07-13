/**
 * Thunk is a value or lazy getter of that value. It is useful if we don't want to have to eagerly provide some value,
 * but instead calculate it when demanded.
 */
 export type Thunk<T> = T | (() => T);

 export function resolveThunk<T>(thunk: Thunk<T>): T {
   if (typeof thunk === "function") {
     return (thunk as () => T)();
   }
 
   return thunk as T;
 }
 