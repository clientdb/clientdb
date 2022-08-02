import { createPermissionNeededJoins } from "../permissions/joins";
import {
  createSchemaPermissionsModel,
  getRawModelRule,
} from "../permissions/model";
import {
  TraverseRelationInfo,
  traverseRule,
  TraverseValueInfo,
} from "../permissions/traverse";
import { permissions, schemaModel } from "./schema";

const permissionsModel = createSchemaPermissionsModel(permissions, schemaModel);

describe("joins", () => {
  it("properly prepares joins", () => {
    const rule = permissionsModel.teamMembership.read!.rule;

    const joins = createPermissionNeededJoins(rule);

    expect(getRawModelRule(rule)).toMatchInlineSnapshot(`
      Object {
        "team": Object {
          "$or": Array [
            Object {
              "owner_id": [Function],
            },
            Object {
              "teamMemberships": Object {
                "is_disabled": false,
                "user_id": [Function],
              },
            },
          ],
        },
      }
    `);

    expect(joins).toMatchInlineSnapshot(`
      Array [
        Object {
          "alias": "teamMembership__team",
          "from": "teamMembership",
          "fromColumn": "team_id",
          "to": "team",
          "toColumn": "id",
        },
        Object {
          "alias": "teamMembership__team__teamMemberships",
          "from": "teamMembership__team",
          "fromColumn": "id",
          "to": "teamMembership",
          "toColumn": "team_id",
        },
      ]
    `);
  });
});
