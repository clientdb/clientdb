import { getRulePartNotImpactedBy } from "@clientdb/server/query/delta/split";
import {
  createSchemaPermissionsModel,
  getRawModelRule,
} from "../permissions/model";
import { permissions, schemaModel } from "./schema";

const permissionsModel = createSchemaPermissionsModel(permissions, schemaModel);

function getDeltaRules(
  impactedBy: string,
  entity: keyof typeof permissionsModel
) {
  let rule = permissionsModel[entity].read!.rule;

  // rule = addChangedEntityToRule(
  //   { entity: impactedBy, id: `<<changed-${impactedBy}>>` },
  //   rule
  // );

  const excluding = getRulePartNotImpactedBy(rule, impactedBy);

  getRawModelRule<any>(rule);

  return [
    getRawModelRule<any>(rule),
    excluding ? getRawModelRule<any>(excluding) : null,
  ] as const;
}

describe("delta", () => {
  describe("splits permission by impacted or not by changed entity", () => {
    it("teamMembership > team", () => {
      const [rule, exluding] = getDeltaRules("teamMembership", "team");

      expect(rule).toMatchInlineSnapshot(`
        Object {
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
        }
      `);

      expect(exluding).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "owner_id": [Function],
            },
          ],
        }
      `);
    });

    it("teamMembership > teamMembership", () => {
      const [rule, exluding] = getDeltaRules(
        "teamMembership",
        "teamMembership"
      );

      expect(rule).toMatchInlineSnapshot(`
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

      expect(exluding).toMatchInlineSnapshot(`null`);
    });

    it("teamMembership > todo", () => {
      const [rule, exclusion] = getDeltaRules("teamMembership", "todo");

      expect(rule).toMatchInlineSnapshot(`
        Object {
          "list": Object {
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
        }
      `);

      expect(exclusion).toMatchInlineSnapshot(`
        Object {
          "list": Object {
            "team": Object {
              "$or": Array [
                Object {
                  "owner_id": [Function],
                },
              ],
            },
          },
        }
      `);
    });

    it("teamMembership > user", () => {
      const [impacted, notImpacted] = getDeltaRules("teamMembership", "user");

      expect(impacted).toMatchInlineSnapshot(`
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

      expect(notImpacted).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "id": [Function],
            },
          ],
        }
      `);
    });
  });
});
