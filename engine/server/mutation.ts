import { DbSchema } from "../schema/schema";

export type MutationRemoveInput = {
  type: "remove";
  entity: string;
  id: string;
};

export type MutationUpdateInput = {
  type: "update";
  entity: string;
  id: string;
  data: object;
};

export type MutationCreateInput = {
  type: "create";
  entity: string;
  data: object;
};

export type MutationInput =
  | MutationRemoveInput
  | MutationUpdateInput
  | MutationCreateInput;

export interface MutationContext {
  userId: string | null;
  schema: DbSchema;
  connector: any;
}

export async function getCanPerformMutation(
  context: MutationContext,
  mutation: MutationInput
): Promise<boolean> {
  switch (mutation.type) {
    case "remove":
      return true;
    case "update":
      return true;
    case "create":
      return true;
    default:
      return false;
  }
}

export async function performMutation(
  context: MutationContext,
  input: MutationInput
): Promise<void> {
  const canPerform = await getCanPerformMutation(context, input);

  if (!canPerform) {
    throw new Error("Cannot perform mutation");
  }

  switch (input.type) {
    case "remove":
      return await context.connector.delete(input.entity, input.id);
    case "update":
      return await context.connector.update(input.entity, input.id, input.data);
    case "create":
      return await context.connector.create(input.entity, input.data);
  }
}
