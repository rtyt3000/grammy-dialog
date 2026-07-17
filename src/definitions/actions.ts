export type NavigationAction =
  | { readonly kind: "go"; readonly windowId: string; readonly data?: unknown }
  | { readonly kind: "replace"; readonly windowId: string; readonly data?: unknown }
  | { readonly kind: "back" }
  | { readonly kind: "reset"; readonly windowId: string; readonly data?: unknown }
  | { readonly kind: "close"; readonly result?: unknown };

export interface IntentAction<Payload = unknown> {
  readonly kind: "intent";
  readonly name: string;
  readonly payload?: Payload;
}

export interface WidgetAction<Payload = unknown> {
  readonly kind: "widget";
  readonly widgetId: string;
  readonly action: string;
  readonly payload?: Payload;
}

export type ButtonAction = IntentAction | NavigationAction | WidgetAction;

export function intent<Payload = undefined>(
  name: string,
  ...payload: Payload extends undefined ? [] : [payload: Payload]
): IntentAction<Payload> {
  return { kind: "intent", name, payload: payload[0] };
}

export function go(windowId: string, data?: unknown): NavigationAction {
  return { kind: "go", windowId, data };
}

export function replace(windowId: string, data?: unknown): NavigationAction {
  return { kind: "replace", windowId, data };
}

export function back(): NavigationAction {
  return { kind: "back" };
}

export function reset(windowId: string, data?: unknown): NavigationAction {
  return { kind: "reset", windowId, data };
}

export function close(result?: unknown): NavigationAction {
  return { kind: "close", result };
}

export interface NavigationController {
  go(windowId: string, data?: unknown): void;
  replace(windowId: string, data?: unknown): void;
  back(): void;
  reset(windowId: string, data?: unknown): void;
  close(result?: unknown): void;
}
