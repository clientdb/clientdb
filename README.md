# ClientDB

ClientDB is an open-source in-memory database for enabling real-time web apps. Build fast, scalable apps that feel silky smooth for users.

## Installation

Install clientdb with yarn

```bash
  yarn add @clientdb/core
```

# Core parts of clientdb

Clientdb is a suite of components that enable real-time web apps. Most of them can be used independently, but they're used together to cover all the aspects of building real-time applications.

## `@clientdb/core`

In-memory database for storing, modifying, and querying data. By itself, it is not synchronized with any server and it is not persisting any data offline.

## `@clientdb/sync`

Work in progress (https://github.com/acapela/clientdb/pull/10)

Sync engine consists of 2 parts:

Server - HTTP server with a socket that can connect to any database and can keep the in-memory database in sync with the server according to defined access permissions.

Client - Wrapper on top of an in-memory database that connects to sync-server and can keep the in-memory database in sync with the server.

Read more about sync engine - [engine/README.md](engine/README.md)

## `@clientdb/codegen` (Work in progress)

Set of dev-toolings for generating TypeScript types and synced client database with all relations, validations, etc. included.

---

## Tech Stack

The entire codebase is fully written in Typescript.

## Build Locally

Clone the project

```bash
  git clone git@github.com:acapela/clientdb.git
```

Install dependencies

```bash
  yarn install
```

Build the client-side db

```bash
  yarn core build
```

## Running Tests

To run tests, run the following command while in /core directory

```bash
  yarn test
```

## Used By

This project is used by the following companies:

- [Acapela](https://acapela.com)

## License

[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)
