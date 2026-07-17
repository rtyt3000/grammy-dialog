/** A value that may be returned immediately or asynchronously. */
export type Awaitable<T> = T | Promise<T>;

/** Mutable view over an instance or widget state used inside action handlers. */
export class StateHandle<State> {
  public constructor(
    private current: State,
    private readonly changed: (state: State) => void,
  ) {}

  /** Returns the latest state value. */
  public get value(): State {
    return this.current;
  }

  /** Replaces the complete state value. */
  public set(value: State): void {
    this.current = value;
    this.changed(value);
  }

  /** Replaces state with the result of applying an updater to its latest value. */
  public update(updater: (value: State) => State): void {
    this.set(updater(this.current));
  }
}
