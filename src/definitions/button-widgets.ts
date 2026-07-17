import type { Context } from "grammy";
import {
  back,
  close,
  go,
  replace,
  reset,
  type ButtonAction,
  type IntentAction,
} from "./actions.js";
import { button, type ButtonDefinition } from "./keyboard.js";
import type { TextSource } from "./rendering.js";

/** Shared options for semantic callback-button widgets. */
export interface ActionButtonOptions {
  /** Stable callback hint; row position is used when omitted. */
  readonly id?: string;
}

/** Options for an intent button. */
export interface IntentButtonOptions<Payload = unknown> extends ActionButtonOptions {
  readonly payload?: Payload;
}

/** Options for navigation buttons that may attach stack-frame data. */
export interface NavigationButtonOptions extends ActionButtonOptions {
  readonly data?: unknown;
}

/** Options for a close button. */
export interface CloseButtonOptions extends ActionButtonOptions {
  readonly result?: unknown;
}

function actionButton<C extends Context, View, Services>(
  text: TextSource<C, View, Services>,
  action: ButtonAction,
  id?: string,
): ButtonDefinition<C, View, Services> {
  return id === undefined ? button(text, action) : button(id, text, action);
}

/** Creates a button that invokes a named ViewModel intent. */
export function intentButton<
  Payload = unknown,
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
  text: TextSource<C, View, Services>,
  name: string,
  options: IntentButtonOptions<Payload> = {},
): ButtonDefinition<C, View, Services> {
  const action: IntentAction<Payload> = { kind: "intent", name, payload: options.payload };
  return actionButton(text, action, options.id);
}

/** Creates a button that pushes a window onto the navigation stack. */
export function goButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  windowId: string,
  options: NavigationButtonOptions = {},
): ButtonDefinition<C, View, Services> {
  return actionButton(text, go(windowId, options.data), options.id);
}

/** Creates a button that replaces the current stack frame. */
export function replaceButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  windowId: string,
  options: NavigationButtonOptions = {},
): ButtonDefinition<C, View, Services> {
  return actionButton(text, replace(windowId, options.data), options.id);
}

/** Creates a button that returns to the previous window. */
export function backButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  options: ActionButtonOptions = {},
): ButtonDefinition<C, View, Services> {
  return actionButton(text, back(), options.id);
}

/** Creates a button that resets the stack to a new root window. */
export function resetButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  windowId: string,
  options: NavigationButtonOptions = {},
): ButtonDefinition<C, View, Services> {
  return actionButton(text, reset(windowId, options.data), options.id);
}

/** Creates a button that closes the active dialog instance. */
export function closeButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  options: CloseButtonOptions = {},
): ButtonDefinition<C, View, Services> {
  return actionButton(text, close(options.result), options.id);
}
