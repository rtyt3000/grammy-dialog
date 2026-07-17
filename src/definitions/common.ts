export type Awaitable<T> = T | Promise<T>;

export class StateHandle<State> {
  public constructor(
    private current: State,
    private readonly changed: (state: State) => void,
  ) {}

  public get value(): State {
    return this.current;
  }

  public set(value: State): void {
    this.current = value;
    this.changed(value);
  }

  public update(updater: (value: State) => State): void {
    this.set(updater(this.current));
  }
}
