export class CodePushInvalidPublicKeyException extends Error {
  cause: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'CodePushInvalidPublicKeyException';
    this.cause = cause;
    if (cause) {
      this.stack = cause.stack;
    }
  }
}