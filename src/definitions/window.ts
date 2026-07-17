import type { Context } from "grammy";
import type { ParseMode } from "grammy/types";
import type { InputDefinition } from "./input.js";
import type { KeyboardSource } from "./keyboard.js";
import type { MediaSource } from "./media.js";
import type { AccessStrategy, ScopeStrategy } from "./policies.js";
import type { TextSource } from "./rendering.js";
import { viewModel, type ViewModelDefinition } from "./view-model.js";

export interface WindowDefinition<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "window";
  readonly id: string;
  readonly viewModel: ViewModelDefinition<State, View, C, Services>;
  readonly text?: TextSource<C, View, Services>;
  readonly parseMode?: ParseMode;
  readonly media?: MediaSource<C, View, Services>;
  readonly keyboard?: KeyboardSource<C, View, Services>;
  readonly input?: ReadonlyArray<InputDefinition<C>>;
  readonly scope?: ScopeStrategy<C>;
  readonly access?: AccessStrategy<C>;
}

export function window<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
>(
  id: string,
  definition: Omit<WindowDefinition<C, State, View, Services>, "kind" | "id">,
): WindowDefinition<C, State, View, Services>;
export function window<C extends Context = Context, Services = unknown>(
  id: string,
  definition: Omit<WindowDefinition<C, {}, {}, Services>, "kind" | "id" | "viewModel"> & {
    readonly viewModel?: undefined;
  },
): WindowDefinition<C, {}, {}, Services>;
export function window(
  id: string,
  definition: Omit<WindowDefinition<any, any, any, any>, "kind" | "id" | "viewModel"> & {
    readonly viewModel?: ViewModelDefinition<any, any, any, any>;
  },
): WindowDefinition<any, any, any, any> {
  return { kind: "window", id, ...definition, viewModel: definition.viewModel ?? viewModel() };
}

export interface DialogDefinition<C extends Context = Context> {
  readonly kind: "dialog";
  readonly id: string;
  readonly initial: string;
  readonly windows: Readonly<Record<string, WindowDefinition<C, any, any, any>>>;
  readonly scope?: ScopeStrategy<C>;
  readonly access?: AccessStrategy<C>;
}

export function defineDialog<C extends Context = Context>(definition: {
  id: string;
  initial?: string;
  windows: Readonly<Record<string, WindowDefinition<C, any, any, any>>>;
  scope?: ScopeStrategy<C>;
  access?: AccessStrategy<C>;
}): DialogDefinition<C> {
  const initial = definition.initial ?? Object.keys(definition.windows)[0];
  if (initial === undefined) {
    throw new Error(`Dialog '${definition.id}' must contain at least one window`);
  }
  return { kind: "dialog", ...definition, initial };
}

export type DialogResource<C extends Context = Context> =
  | DialogDefinition<C>
  | WindowDefinition<C, any, any, any>;
