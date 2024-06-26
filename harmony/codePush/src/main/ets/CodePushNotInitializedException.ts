export class CodePushNotInitializedException extends Error {
  cause: Error;

  constructor(message: string, cause?: Error) {
    super(message);

    // 设置异常堆栈跟踪，如果提供了原因（cause）。
    if (cause) {
      this.cause = cause;
      this.stack = cause.stack;
    }

    // 设置异常名称，用于识别异常类型。
    this.name = 'CodePushNotInitializedException';
  }
}