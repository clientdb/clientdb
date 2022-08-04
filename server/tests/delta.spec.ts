import { ExistsDeltaQueryBuilder } from "../permissions/ExistsDeltaQueryBuilder";
import { permissionsModel, permissions, schemaModel } from "./schema";

function getDeltaRules(impactedBy: string, entity: keyof typeof permissions) {
  let rule = permissionsModel.getPermissionRule(entity, "read")!;

  const builder = new ExistsDeltaQueryBuilder(rule!, {
    changed: { entity: impactedBy, id: `<<changed-${impactedBy}>>` },
    type: "put",
  });

  // rule = addChangedEntityToRule(
  //   { entity: impactedBy, id: `<<changed-${impactedBy}>>` },
  //   rule
  // );

  const excluding = builder.alreadyHadAccessRule;

  return [rule.raw, excluding.rule.isEmpty ? null : excluding.raw] as const;
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

      expect(exluding).toMatchInlineSnapshot(`
        Object {
          "team": Object {
            "$or": Array [
              Object {
                "owner_id": [Function],
              },
            ],
          },
        }
      `);
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

  it("team > todo", () => {
    const [impacted, notImpacted] = getDeltaRules("team", "todo");

    expect(impacted).toMatchInlineSnapshot(`
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

    expect(notImpacted).toMatchInlineSnapshot(`null`);
  });
});
