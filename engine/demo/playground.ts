import { todoEntity, ViewData } from "clientdb/generated";

const view = todoEntity.extendView((todo) => {
  return {
    get isCool() {
      return todo.power > 4000;
    },
  };
});

declare module "clientdb/generated" {
  interface TodoView extends ViewData<typeof view> {}
}

db.on("transaction", (changes) => {});

import { runInTrasaction } from "cdb";

function handleCreate() {
  const [list, todo] = runInTrasaction(() => {
    const list = db.entity(listEntity).create({
      name: "Cool List",
      is_private: false,
    });
    const todo = db.entity(todo).create({
      name: "Cool Todo",
      list_id: list.id,
    });

    return [list, todo] as const;
  });

  showToast({
    label: `List - ${list.name} created`,
  });

  const end = startTransaction();

  const list = db.entity(listEntity).create({
    name: "Cool List",
    is_private: false,
  });
  const todo = db.entity(todo).create({
    name: "Cool Todo",
    list_id: list.id,
  });

  end();

  showToast({
    label: `List - ${list.name} created`,
  });
}
