import { ApolloClient } from "@apollo/client";

import { createDbContext } from "clientdb";

export const userIdContext = createDbContext<string | null>();
export const teamIdContext = createDbContext<string | null>();
export const apolloContext = createDbContext<ApolloClient<unknown>>();
