import { addChangedEntityToRule } from "@clientdb/server/query/delta/injectId";
import { getRulePartNotImpactedBy } from "@clientdb/server/query/delta/split";
import { permissions, schemaModel } from "./schema";

function getDeltaRules(impactedBy: string, entity: keyof typeof permissions) {
  let rule = permissions[entity].read!.rule;

  rule = addChangedEntityToRule({
    entity: entity as string,
    changed: { entity: impactedBy, id: `<<changed-${impactedBy}>>` },
    rule,
    schema: schemaModel,
  });

  const notImpacted = getRulePartNotImpactedBy(
    rule,
    entity as string,
    impactedBy,
    schemaModel
  );

  return [rule, notImpacted] as const;
}

describe("delta", () => {
  describe("splits permission by impacted or not by changed entity", () => {
    it("teamMembership > team", () => {
      const [impacted, notImpacted] = getDeltaRules("teamMembership", "team");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "owner_id": [Function],
            },
            Object {
              "teamMemberships": Object {
                "id": "<<changed-teamMembership>>",
                "is_disabled": false,
                "user_id": [Function],
              },
            },
          ],
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`
        Object {
          "owner_id": [Function],
        }
      `);
    });

    it("teamMembership > todo", () => {
      const [impacted, notImpacted] = getDeltaRules("teamMembership", "todo");

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
                    "id": "<<changed-teamMembership>>",
                    "is_disabled": false,
                    "user_id": [Function],
                  },
                },
              ],
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
      const [impacted, notImpacted] = getDeltaRules("teamMembership", "user");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "id": [Function],
            },
            Object {
              "teamMemberships": Object {
                "id": "<<changed-teamMembership>>",
                "team": Object {
                  "$or": Array [
                    Object {
                      "owner_id": [Function],
                    },
                    Object {
                      "teamMemberships": Object {
                        "id": "<<changed-teamMembership>>",
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
          "id": [Function],
        }
      `);
    });

    it("team > teamMembership", () => {
      const [impacted, notImpacted] = getDeltaRules("team", "teamMembership");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "team": Object {
            "$or": Array [
              Object {
                "id": "<<changed-team>>",
                "owner_id": [Function],
              },
              Object {
                "id": "<<changed-team>>",
                "teamMemberships": Object {
                  "is_disabled": false,
                  "user_id": [Function],
                },
              },
            ],
            "id": "<<changed-team>>",
          },
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`null`);
    });

    it("label > label", () => {
      const [impacted, notImpacted] = getDeltaRules("label", "label");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "id": "<<changed-label>>",
              "is_public": true,
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
            Object {
              "id": "<<changed-label>>",
              "user_id": [Function],
            },
          ],
          "id": "<<changed-label>>",
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`null`);
    });

    it("label > todoLabel", () => {
      const [impacted, notImpacted] = getDeltaRules("label", "todoLabel");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "label": Object {
            "$or": Array [
              Object {
                "id": "<<changed-label>>",
                "is_public": true,
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
              Object {
                "id": "<<changed-label>>",
                "user_id": [Function],
              },
            ],
            "id": "<<changed-label>>",
          },
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`null`);
    });

    it("list > list", () => {
      const [impacted, notImpacted] = getDeltaRules("list", "list");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "id": "<<changed-list>>",
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

      expect(notImpacted).toMatchInlineSnapshot(`
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
    });

    it("user > user", () => {
      const [impacted, notImpacted] = getDeltaRules("user", "user");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "$or": Array [
            Object {
              "id": [Function],
            },
            Object {
              "id": "<<changed-user>>",
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
          "id": "<<changed-user>>",
        }
      `);

      expect(notImpacted).toMatchInlineSnapshot(`null`);
    });

    it("list > todo", () => {
      const [impacted, notImpacted] = getDeltaRules("list", "todo");

      expect(impacted).toMatchInlineSnapshot(`
        Object {
          "list": Object {
            "id": "<<changed-list>>",
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

      expect(notImpacted).toMatchInlineSnapshot(`
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
    });
  });
});
