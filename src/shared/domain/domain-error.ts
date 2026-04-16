export abstract class DomainError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;

  protected constructor(
    name: string,
    code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = name;
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
