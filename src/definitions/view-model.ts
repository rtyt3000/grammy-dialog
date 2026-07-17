import type { Context } from "grammy";
import type { NavigationController } from "./actions.js";
import type { Awaitable, StateHandle } from "./common.js";

/** Read-only values available while loading a ViewModel view. */
export interface ViewModelLoadContext<C extends Context, State, Services> {
  readonly ctx: C | undefined;
  readonly state: State;
  readonly services: Services;
  readonly actor: { id?: number; chatId: number };
}

/** Values available to a ViewModel intent handler. */
export interface IntentContext<
  C extends Context,
  State,
  View,
  Services,
  Payload = unknown,
  Value = unknown,
> {
  readonly ctx: C;
  readonly state: StateHandle<State>;
  readonly vm: View;
  readonly services: Services;
  readonly navigation: NavigationController;
  readonly payload: Payload;
  readonly value: Value;
}

/** Handles a named user intent and may mutate state or navigate. */
export type IntentHandler<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
  Payload = unknown,
  Value = unknown,
> = (context: IntentContext<C, State, View, Services, Payload, Value>) => Awaitable<void>;

/** Definition-time reference serialized as an intent name in callbacks and inputs. */
export interface IntentReference<Payload = unknown, Value = unknown> {
  readonly kind: "intent-reference";
  readonly name: string;
  /** Type-only marker for callback payloads. */
  readonly __payload?: Payload;
  /** Type-only marker for received input values. */
  readonly __value?: Value;
}

type IntentReferences<Intents extends Record<string, IntentHandler<any, any, any, any>>> = {
  readonly [Name in keyof Intents]: Intents[Name] extends IntentHandler<
    any,
    any,
    any,
    any,
    infer Payload,
    infer Value
  > ? IntentReference<Payload, Value> : never;
};

/** Runtime-normalized ViewModel definition used by a window. */
export interface ViewModelDefinition<
  State = unknown,
  View = unknown,
  C extends Context = Context,
  Services = unknown,
  Intents extends Record<string, IntentHandler<C, State, View, Services, any, any>> = Record<
    string,
    IntentHandler<C, State, View, Services, any, any>
  >,
> {
  readonly initialState: () => State;
  readonly load: (context: ViewModelLoadContext<C, State, Services>) => Awaitable<View>;
  readonly intents: Intents;
  /** Stable, typed references used by buttons and input bindings. */
  readonly actions: IntentReferences<Intents>;
}

/**
 * Context-bound ViewModel factory that avoids repeating application context and
 * service types in every ViewModel definition.
 */
export interface ViewModelFactory<C extends Context, Services> {
  /** Creates an identity ViewModel whose view is its state. */
  <
    State,
    Intents extends Record<string, IntentHandler<C, State, State, Services, any, any>> = {},
  >(definition: {
    initialState: State | (() => State);
    load?: undefined;
    intents?: Intents & Record<string, IntentHandler<C, State, State, Services, any, any>>;
  }): ViewModelDefinition<State, State, C, Services, Intents>;

  /** Creates a ViewModel with an inferred custom view. */
  <
    State,
    View,
    Intents extends Record<string, IntentHandler<C, State, View, Services, any, any>> = Record<
      string,
      IntentHandler<C, State, View, Services, any, any>
    >,
  >(definition: {
    initialState?: State | (() => State);
    load: (context: ViewModelLoadContext<C, State, Services>) => Awaitable<View>;
    intents?: Intents & Record<string, IntentHandler<C, State, View, Services, any, any>>;
  }): ViewModelDefinition<State, View, C, Services, Intents>;
}

/** Creates a ViewModel factory preconfigured with application context and services. */
export function createViewModelFactory<
  C extends Context = Context,
  Services = unknown,
>(): ViewModelFactory<C, Services> {
  return ((definition: Parameters<typeof viewModel>[0]) => viewModel(definition)) as unknown as
    ViewModelFactory<C, Services>;
}

/** Creates an empty identity ViewModel for a static or stateless window. */
export function viewModel(): ViewModelDefinition<{}, {}, Context, unknown, {}>;
/** Creates an identity ViewModel whose rendered view is its current state. */
export function viewModel<
  State,
  C extends Context = Context,
  Services = unknown,
  Intents extends Record<string, IntentHandler<C, State, State, Services, any, any>> = {},
>(definition: {
  initialState: State | (() => State);
  load?: undefined;
  intents?: Intents & Record<string, IntentHandler<C, State, State, Services, any, any>>;
}): ViewModelDefinition<State, State, C, Services, Intents>;
/** Creates a ViewModel with a custom asynchronous or synchronous view loader. */
export function viewModel<
  State,
  View,
  C extends Context = Context,
  Services = unknown,
  Intents extends Record<string, IntentHandler<C, State, View, Services, any, any>> = Record<
    string,
    IntentHandler<C, State, View, Services, any, any>
  >,
>(definition: {
  initialState?: State | (() => State);
  load: (context: ViewModelLoadContext<C, State, Services>) => Awaitable<View>;
  intents?: Intents & Record<string, IntentHandler<C, State, View, Services, any, any>>;
}): ViewModelDefinition<State, View, C, Services, Intents>;
export function viewModel(definition: {
  initialState?: unknown | (() => unknown);
  load?: (context: ViewModelLoadContext<any, any, any>) => Awaitable<unknown>;
  intents?: Record<string, IntentHandler<any, any, any, any>>;
} = {}): ViewModelDefinition<any, any, any, any, any> {
  const initialState = definition.initialState ?? {};
  return {
    initialState: typeof initialState === "function"
      ? initialState as () => unknown
      : () => structuredClone(initialState),
    load: definition.load ?? (({ state }) => state),
    intents: definition.intents ?? {},
    actions: Object.fromEntries(
      Object.keys(definition.intents ?? {}).map(name => [
        name,
        Object.freeze({ kind: "intent-reference", name }),
      ]),
    ),
  };
}
