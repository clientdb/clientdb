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

describe("traverse", () => {
  it("properly traverses permission", () => {
    const rule = permissionsModel.teamMembership.read!.rule;

    const inputs: any[] = [];

    function captureRelation(info: TraverseRelationInfo) {
      inputs.push({
        $type: "relation",
        ...info,
        rule: getRawModelRule(info.rule),
        // rule: null,
      });
    }

    function captureValue(input: TraverseValueInfo) {
      inputs.push({
        $type: "value",
        ...input,
        parentRule: getRawModelRule(input.parentRule),
        // parentRule: null,
      });
    }

    traverseRule(rule, {
      onRelation: captureRelation,
      onValue: captureValue,
    });

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

    expect(inputs).toMatchInlineSnapshot(`
      Array [
        Object {
          "$type": "relation",
          "conditionPath": Array [],
          "entity": "teamMembership",
          "rule": Object {
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
          },
          "schemaPath": Array [
            "teamMembership",
          ],
          "selector": "teamMembership",
        },
        Object {
          "$type": "relation",
          "conditionPath": Array [],
          "entity": "team",
          "rule": Object {
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
          "schemaPath": Array [
            "teamMembership",
            "team",
          ],
          "selector": "teamMembership__team",
        },
        Object {
          "$type": "value",
          "conditionPath": Array [
            "or",
            0,
          ],
          "entity": "team",
          "parentRule": Object {
            "owner_id": [Function],
          },
          "referencedEntity": "user",
          "rule": Object {
            "$eq": [Function],
          },
          "schemaPath": Array [
            "teamMembership",
            "team",
            "owner_id",
          ],
          "selector": "teamMembership__team.owner_id",
        },
        Object {
          "$type": "relation",
          "conditionPath": Array [
            "or",
            1,
          ],
          "entity": "teamMembership",
          "rule": Object {
            "is_disabled": false,
            "user_id": [Function],
          },
          "schemaPath": Array [
            "teamMembership",
            "team",
            "teamMemberships",
          ],
          "selector": "teamMembership__team__teamMemberships",
        },
        Object {
          "$type": "value",
          "conditionPath": Array [
            "or",
            1,
          ],
          "entity": "teamMembership",
          "parentRule": Object {
            "is_disabled": false,
            "user_id": [Function],
          },
          "referencedEntity": null,
          "rule": Object {
            "$eq": false,
          },
          "schemaPath": Array [
            "teamMembership",
            "team",
            "teamMemberships",
            "is_disabled",
          ],
          "selector": "teamMembership__team__teamMemberships.is_disabled",
        },
        Object {
          "$type": "value",
          "conditionPath": Array [
            "or",
            1,
          ],
          "entity": "teamMembership",
          "parentRule": Object {
            "is_disabled": false,
            "user_id": [Function],
          },
          "referencedEntity": "user",
          "rule": Object {
            "$eq": [Function],
          },
          "schemaPath": Array [
            "teamMembership",
            "team",
            "teamMemberships",
            "user_id",
          ],
          "selector": "teamMembership__team__teamMemberships.user_id",
        },
      ]
    `);
  });
});
