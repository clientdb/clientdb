import { permissionsModel } from "./schema";

describe("joins", () => {
  it("properly prepares joins", () => {
    const rule = permissionsModel.getPermissionRule("teamMembership", "read")!;

    const joins = rule.accessQuery().joins;

    expect(rule.input).toMatchInlineSnapshot(`
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
          "on": Object {
            "left": "teamMembership.team_id",
            "right": "teamMembership__team.id",
          },
          "selector": "teamMembership__team",
          "table": "team",
        },
        Object {
          "on": Object {
            "left": "teamMembership__team.id",
            "right": "teamMembership__team__teamMemberships.team_id",
          },
          "selector": "teamMembership__team__teamMemberships",
          "table": "teamMembership",
        },
      ]
    `);
  });
});
