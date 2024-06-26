export class CodePushUnknownException extends Error {
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;

    // 设置异常堆栈跟踪，如果提供了原因（cause）。
    if (cause) {
      this.stack = cause.stack;
    }

    // 设置异常名称，用于识别异常类型。
    this.name = 'CodePushUnknownException';
  }
}