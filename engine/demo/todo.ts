import {
  TodoPermissionFilter,
  TodoPermissions,
  CurrentUserId,
} from "clientdb/generated";

const userOwnsTodo: TodoPermissionFilter = {
  userId: CurrentUserId,
};

const todoIsPartOfPublicList: TodoPermissionFilter = {
  list: {
    is_private: false,
  },
};

const permissions: TodoPermissions = {
  query: {
    filter: { $or: [userOwnsTodo, todoIsPartOfPublicList] },
    fields: ["id", "name", "list_id"],
  },
  create: { filter: userOwnsTodo, fields: ["id", "name", "list_id"] },
  update: { filter: userOwnsTodo, fields: ["name", "list_id"] },
  remove: { filter: userOwnsTodo },
};

export default permissions;
