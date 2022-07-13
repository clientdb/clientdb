import {
  ListPermissionFilter,
  ListPermissions,
  CurrentUserId,
} from "clientdb/generated";

const userOwnsList: ListPermissionFilter = {
  userId: CurrentUserId,
};

const listIsPublic: ListPermissionFilter = {
  is_private: false,
};

const permissions: ListPermissions = {
  query: {
    filter: { $or: [userOwnsList, listIsPublic] },
    fields: ["id", "name", "is_private"],
  },
  create: { filter: userOwnsList, fields: ["id", "name", "is_private"] },
  update: { filter: userOwnsList, fields: ["name", "is_private"] },
  remove: { filter: userOwnsList },
};

export default permissions;
