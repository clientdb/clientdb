import { createInitialLoadQuery } from "../query/init";
import { createTestServer } from "./server";

describe("init", () => {
  it("prepares proper init query", async () => {
    const server = await createTestServer();

    const context = server.admin.createContext({ userId: "user-id" });

    const initQuery = createInitialLoadQuery(context, "label");

    expect(initQuery?.toString()).toEqual(
      `select "label"."id", "label"."name", "label"."user_id", "label"."team_id", "label"."is_public" from "label" left join "team" as "label__team" on "label"."team_id" = "label__team"."id" left join "teamMembership" as "label__team__teamMemberships" on "label__team"."id" = "label__team__teamMemberships"."team_id" where (("label"."is_public" = true and (("label__team"."owner_id" = 'user-id') or ("label__team__teamMemberships"."is_disabled" = false and "label__team__teamMemberships"."user_id" = 'user-id'))) or ("label"."user_id" = 'user-id')) group by "label"."id"`
    );
  });
});
