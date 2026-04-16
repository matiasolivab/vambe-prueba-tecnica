export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private current: Date;

  constructor(instant: Date) {
    this.current = new Date(instant.getTime());
  }

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
