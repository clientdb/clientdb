# Sync engine

The goal of this package is to create a server and client that can keep the in-memory database in sync with the server according to defined access permissions.

### Notes

The architecture of clientdb is inspired by the Linear app - watch this talk https://youtu.be/WxK11RsLqp4?t=2175 (36:00)

# Architecture, challenges, and, goals

The core philosophy and goal are:

> Each row in the database should be sent to the client only once ever unless changed, removed, or the user lost/gained permission to see it. This should also apply if the user reloads the app and has persisted offline data.

## Tracking changes

Tracking changes and keeping client and server in sync is tricky.

The simplest and the most naive approach could be to fetch all the data user has access to on every app load, and then watch for changes in real-time.

This is how a lot of apps work. But even with that - it is still tricky to track changes.

## What kind of changes require the client to sync with the server?

### Direct changes

Some row is changed or removed, eg. we modify the name of `team` and each team member should receive this change. The same applies to removal - if `team` is removed, each client should remove it locally. This is relatively the simplest case.

### Impacted permission changes

User gains/loses permission to see some row as a result of a change that can happen in a totally different row.

Example:

We have a task tracker for teams. Each user can create a custom `board` and add `tasks` to it. Such a board can be either `public` or `private` (`is_public=true/false`).

If it is public - every other team member can see it together with all tasks in it.

Only the owner of the board can see it and tasks in it if it is private.

As a result, if at some point owner changes some board from public to private:

- from the perspective of the owner - it is a simple update of the `is_public` flag - no other changes happened as the owner is still able to see it
- from the perspective of other team members - they should remove both the board and all tasks in it from their local database.

As seen - one small change can have various implications and those implications can be different for every user.

Even more, examples can be eg `team_membership` row that has `is_active` flag. If at some point `is_active` is set to false, or membership is removed - it can result in a sync request that will remove a lot of rows across the entire local database.

## Tracking removes and lost permission when the user is offline

On top of the problems described above, we need to make sure we sent properly 'remove' sync requests to clients, even if they were offline at the moment of changes and opened the app sometime later.

In order to do that, we need some way of tracking removed rows and lost permissions.

To do that, a special table called `sync_request` is added to the connected database.

Its structure is like this:

```
id - int (auto-increment) # id of sync request

entity # name of a table that needs syncing

entity_id # id of a row that needs syncing

type # 'remove' or 'put' - what change should the client perform in a local database

data # if 'type' is 'put' - data of a given row that is to be created or updated in a local database

user_id # id of the user that needs to perform a given update
schema_hash # internal field - makes sure that the client will not sync changes that happened in a different version of database schema (eg. was offline while the app was updated adding new tables - on schema mismatch, the client will remove all data from local database and perform a complete reload)
```

Now, after each change made by any user (create, update, remove), we calculate the 'sync impact' for all other users (including the author of a change in case the author is using the app on multiple devices) and save it in `sync_request` table.

Each client locally keeps an id called `last_sync_request`. This way we know at which point of time the user last synced with the server.

Each time user opens the app, we load all sync requests that were made after the last sync request and then start listening in real-time for new sync requests.

## How 'sync impact' is calculated?

We use the permissions object passed to the server to calculate the 'sync impact' of any change.

For the example above, if we have `team`, `team_membership`, `board`, and `task` tables, we could have such read permissions config:

(Code is simplified for readability)

```ts
const canSeeBoard: BoardPermission = {
  // User can see board if:
  $or: [
    // Board is public and the user is a member of the team this board is part of
    {
      is_public: true,
      team: {
        teamMemberships: {
          user_id: currentUser,
        },
      },
    },
    // Or the current user is the owner of the board
    {
      owner_id: currentUser,
    },
  ],
};

const accessPermissions: Permissions = {
  board: canSeeBoard,
  task: {
    // User can see task only if it is part of a board that user can see
    board: canSeeBoard,
  },
};
```

As a result of that, eg. if board `is_public` is changed from `true` to `false` (board becomes private), we can generate SQL queries that logically are equal to:

- get all team members of the team this board is part of
- for those members who are not owners of this board:
  - create a sync request to remove this board
  - create a sync request to remove all tasks on this board
- for the owner of this board:
  - create a sync request to update the `is_public` flag of this board to `false`

Let's say we had 3 users - `board_owner`, `member_1` and `member_2`. 1 board `board_1` and 1 task belonging to this board `task_1`.

Sync requests for the board to become private would be

```
board_owner: update board_1 set is_public = false
member_1: remove board_1
member_2: remove board_1
member_1: remove task_1
member_2: remove task_1
```
