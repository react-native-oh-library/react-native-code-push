export class CodePushMalformedDataException extends Error {
  cause: Error;

  constructor(path: string, cause: Error) {
    super(`Unable to parse contents of ${path}, the file may be corrupted.`);
    this.name = 'CodePushMalformedDataException';
    this.cause = cause;
    if (cause) {
      this.stack = cause.stack;
    }
  }

  static fromUrl(url: string, cause: Error): CodePushMalformedDataException {
    return new CodePushMalformedDataException(`The package has an invalid downloadUrl: ${url}`, cause);
  }
}