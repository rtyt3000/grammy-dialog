import type { IntentReference } from "./view-model.js";

/** A stack navigation command produced by a button or an intent handler. */
export type NavigationAction =
  | { readonly kind: "go"; readonly windowId: string; readonly data?: unknown }
  | {
      readonly kind: "replace";
      readonly windowId: string;
      readonly data?: unknown;
    }
  | { readonly kind: "back" }
  | {
      readonly kind: "reset";
      readonly windowId: string;
      readonly data?: unknown;
    }
  | { readonly kind: "close"; readonly result?: unknown };

/** Invokes a named intent on the current window's ViewModel. */
export interface IntentAction<Payload = unknown> {
  readonly kind: "intent";
  readonly name: string;
  readonly payload?: Payload;
}

/** Invokes an action belonging to a stateful keyboard widget. */
export interface WidgetAction<Payload = unknown> {
  readonly kind: "widget";
  readonly widgetId: string;
  readonly action: string;
  readonly payload?: Payload;
}

/** Any action supported by a callback button. */
export type ButtonAction = IntentAction | NavigationAction | WidgetAction;

/** Creates an action that invokes a ViewModel intent with an optional payload. */
export function intent<Payload = undefined>(
  name: string | IntentReference<Payload, any>,
  ...payload: Payload extends undefined ? [] : [payload: Payload]
): IntentAction<Payload> {
  return {
    kind: "intent",
    name: typeof name === "string" ? name : name.name,
    payload: payload[0],
  };
}

/** Pushes a window onto the current dialog stack. */
export function go(windowId: string, data?: unknown): NavigationAction {
  return { kind: "go", windowId, data };
}

/** Replaces the top stack frame with another window. */
export function replace(windowId: string, data?: unknown): NavigationAction {
  return { kind: "replace", windowId, data };
}

/** Removes the top stack frame, or closes the instance at the stack root. */
export function back(): NavigationAction {
  return { kind: "back" };
}

/** Replaces the entire stack with a new root window. */
export function reset(windowId: string, data?: unknown): NavigationAction {
  return { kind: "reset", windowId, data };
}

/** Closes the current dialog instance and optionally carries a result. */
export function close(result?: unknown): NavigationAction {
  return { kind: "close", result };
}

/** Imperative navigation API available to intent and widget action handlers. */
export interface NavigationController {
  go(windowId: string, data?: unknown): void;
  replace(windowId: string, data?: unknown): void;
  back(): void;
  reset(windowId: string, data?: unknown): void;
  close(result?: unknown): void;
}
