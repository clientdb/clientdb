import { createSchemaPermissionsModel } from "../permissions/model";
import { permissions, schemaModel } from "./schema";

describe("permissions-model", () => {
  it("parses permissions", () => {
    const permissionsModel = createSchemaPermissionsModel(
      permissions,
      schemaModel
    );

    const userRawRule = permissions.user.read!.rule;
    const userRule = permissionsModel.user.read!.rule;

    expect(userRule.$entity).toBe("user");
    expect(userRule.$parent).toBe(null);

    expect(userRule.$or).toHaveLength(userRawRule.$or!.length);

    expect(userRule.$or![0].$entity).toBe("user");
    expect(userRule.$or![0].$parent).toBe(userRule);

    // console.dir(permissionsModel, { depth: null });
  });
});
