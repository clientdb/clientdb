export class UnauthorizedError extends Error {}
export class BadRequestError extends Error {}

export function getIsKnownError(error: unknown): boolean {
  if (!error) return false;

  return error instanceof UnauthorizedError || error instanceof BadRequestError;
}
