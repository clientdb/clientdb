import { splitRuleByImpactingEntity } from "../server/access/delta/split";
import { deepLog } from "../utils/log";
import { permissions, schemaModel } from "./schema";

function getImpactRules(impactedBy: string, entity: keyof typeof permissions) {
  const teamReadRule = permissions[entity].read!.rule;

  return splitRuleByImpactingEntity(
    teamReadRule,
    entity,
    impactedBy,
    schemaModel
  );
}

describe("delta", () => {
  describe("splits permission by impacted or not by changed entity", () => {
    it("teamMembership > team", () => {
      const [impacted, notImpacted] = getImpactRules("teamMembership", "team");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "teamMemberships": Object {
            "is_disabled": false,
            "user_id": [Function],
          },
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`
        Object {
          "owner_id": [Function],
        }
      `);
    });

    it("teamMembership > todo", () => {
      const [impacted, notImpacted] = getImpactRules("teamMembership", "todo");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "list": Object {
            "team": Object {
              "teamMemberships": Object {
                "is_disabled": false,
                "user_id": [Function],
              },
            },
          },
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`
        Object {
          "list": Object {
            "team": Object {
              "owner_id": [Function],
            },
          },
        }
      `);
    });

    it("teamMembership > user", () => {
      const [impacted, notImpacted] = getImpactRules("teamMembership", "user");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "teamMemberships": Object {
            "team": Object {
              "teamMemberships": Object {
                "is_disabled": false,
                "user_id": [Function],
              },
            },
          },
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "id": [Function],
            },
            Object {
              "teamMemberships": Object {
                "team": Object {
                  "owner_id": [Function],
                },
              },
            },
          ],
        }
      `);
    });

    it("label > todoLabel", () => {
      const [impacted, notImpacted] = getImpactRules("label", "todoLabel");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "label": Object {
            "$or": Array [
              Object {
                "is_public": true,
              },
              Object {
                "user_id": [Function],
              },
            ],
          },
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`
        Object {
          "label": Object {
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
    });
  });
});
