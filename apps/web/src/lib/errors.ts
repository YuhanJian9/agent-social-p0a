export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: string;
  readonly extra?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    messageKey: string,
    extra?: Record<string, unknown>,
  ) {
    super(code);
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.extra = extra;
  }
}
