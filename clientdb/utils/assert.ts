
export class AssertError extends Error {
  constructor(message: string) {
    super(`Assert error - ${message}`);
    this.name = "AssertError";
  }
}

export type MessageOrError = string | Error;

function getErrorFromMessageOrError(messageOrError: MessageOrError): Error {
  if (typeof messageOrError === "string") {
    return new AssertError(messageOrError);
  }

  return messageOrError;
}


export function assert(
  input: unknown,
  messageOrError: MessageOrError,
 
): asserts input {
  if (input) {
    return;
  }

  const error = getErrorFromMessageOrError(messageOrError);


  throw error;
}

export function unsafeAssert(input: unknown): asserts input {
  //
}

export function unsafeAssertType<T>(input: unknown): asserts input is T {
  //
}
