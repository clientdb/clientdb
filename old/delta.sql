select
  'user' as entity,
  "user"."id" as "id",
  "allowed_user"."id" as "user_id"
from
  "user"
  cross join "user" as "allowed_user"
  left join "teamMembership" as "user__teamMemberships" on "user"."id" = "user__teamMemberships"."user_id"
  left join "team" as "user__teamMemberships__team" on "user__teamMemberships"."team_id" = "user__teamMemberships__team"."id"
  left join "teamMembership" as "user__teamMemberships__team__teamMemberships" on "user__teamMemberships__team"."id" = "user__teamMemberships__team__teamMemberships"."team_id"
where
  (
    "user__teamMemberships"."id" = '024bc3ab-6a2c-48bf-99ea-8fdd5c3399a5'
    or "user__teamMemberships__team__teamMemberships"."id" = '024bc3ab-6a2c-48bf-99ea-8fdd5c3399a5'
  )
  and (
    (
      ("user"."id" = allowed_user.id)
      or (
        "user__teamMemberships"."id" = '024bc3ab-6a2c-48bf-99ea-8fdd5c3399a5'
        and (
          (
            "user__teamMemberships__team"."owner_id" = allowed_user.id
          )
          or (
            "user__teamMemberships__team__teamMemberships"."user_id" = allowed_user.id
            and "user__teamMemberships__team__teamMemberships"."is_disabled" = false
            and "user__teamMemberships__team__teamMemberships"."id" = '024bc3ab-6a2c-48bf-99ea-8fdd5c3399a5'
          )
        )
      )
    )
  )
  and not (
    (
      ("user"."id" = allowed_user.id)
      or (
        "user__teamMemberships__team"."owner_id" = allowed_user.id
      )
    )
  )