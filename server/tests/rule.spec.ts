import { PermissionRule } from "../permissions/PermissionRule";
import { permissionsModel } from "./schema";

function collectRule(ruleRoot: PermissionRule) {
  const values: string[] = [];
  const rules: string[] = [];

  for (const { rule, value } of ruleRoot) {
    if (rule) {
      rules.push(rule.selector);
    }

    if (value) {
      values.push(value.selector);
    }
  }

  return { rules, values };
}

describe("rule", () => {
  it("picks values", () => {
    const memberRule = permissionsModel.getPermissionRule(
      "teamMembership",
      "read"
    )!;

    expect(memberRule.input).toMatchInlineSnapshot(`
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

    expect(collectRule(memberRule)).toMatchInlineSnapshot(`
      Object {
        "rules": Array [
          "teamMembership",
          "teamMembership__team",
          "teamMembership__team__teamMemberships",
        ],
        "values": Array [
          "teamMembership__team.owner_id",
          "teamMembership__team__teamMemberships.is_disabled",
          "teamMembership__team__teamMemberships.user_id",
        ],
      }
    `);

    const userRule = permissionsModel.getPermissionRule("user", "read")!;

    expect(userRule.input).toMatchInlineSnapshot(`
      Object {
        "$or": Array [
          Object {
            "id": [Function],
          },
          Object {
            "teamMemberships": Object {
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
          },
        ],
      }
    `);

    expect(collectRule(userRule)).toMatchInlineSnapshot(`
      Object {
        "rules": Array [
          "user",
          "user__teamMemberships",
          "user__teamMemberships__team",
          "user__teamMemberships__team__teamMemberships",
        ],
        "values": Array [
          "user.id",
          "user__teamMemberships__team.owner_id",
          "user__teamMemberships__team__teamMemberships.user_id",
          "user__teamMemberships__team__teamMemberships.is_disabled",
        ],
      }
    `);
  });
});
