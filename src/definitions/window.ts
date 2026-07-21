import type { Context } from "grammy";
import type { InputDefinition } from "./input.js";
import type { AccessStrategy, ScopeStrategy } from "./policies.js";
import type { JsxViewSource } from "../jsx/types.js";
import { viewModel, type ViewModelDefinition } from "./view-model.js";

/** Declarative definition of one renderable Telegram surface. */
export interface WindowDefinition<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "window";
  readonly id: string;
  /** Standalone state owner or the inherited dialog ViewModel normalized by DialogKit. */
  readonly viewModel: ViewModelDefinition<State, View, C, Services>;
  /** The sole presentation source for this Telegram surface. */
  readonly view?: JsxViewSource<C, View, Services>;
  readonly input?: ReadonlyArray<InputDefinition<C>>;
  readonly access?: AccessStrategy<C>;
}

/** Creates a window backed by an explicit ViewModel. */
export function window<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
>(
  id: string,
  definition: Omit<WindowDefinition<C, State, View, Services>, "kind" | "id">,
): WindowDefinition<C, State, View, Services>;
/** Creates a static window with an automatically supplied empty ViewModel. */
export function window<C extends Context = Context, Services = unknown>(
  id: string,
  definition: Omit<
    WindowDefinition<C, {}, {}, Services>,
    "kind" | "id" | "viewModel"
  > & {
    readonly viewModel?: undefined;
  },
): WindowDefinition<C, {}, {}, Services>;
export function window(
  id: string,
  definition: Omit<
    WindowDefinition<any, any, any, any>,
    "kind" | "id" | "viewModel"
  > & {
    readonly viewModel?: ViewModelDefinition<any, any, any, any>;
  },
): WindowDefinition<any, any, any, any> {
  return {
    kind: "window",
    id,
    ...definition,
    viewModel: definition.viewModel ?? viewModel(),
  };
}

/** Declarative group of windows sharing one navigation stack. */
export interface DialogDefinition<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "dialog";
  readonly id: string;
  readonly initial: string;
  /** The single state owner shared by every window in this dialog. */
  readonly viewModel: ViewModelDefinition<State, View, C, Services>;
  readonly windows: Readonly<
    Record<string, WindowDefinition<C, State, View, Services>>
  >;
  readonly scope?: ScopeStrategy<C>;
  readonly access?: AccessStrategy<C>;
}

/**
 * Creates a dialog definition.
 *
 * When `initial` is omitted, the first key in `windows` is used.
 * @throws When no initial window can be resolved.
 */
export function defineDialog<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
>(definition: {
  id: string;
  initial?: string;
  viewModel: ViewModelDefinition<State, View, C, Services>;
  windows: Readonly<Record<string, WindowDefinition<C, State, View, Services>>>;
  scope?: ScopeStrategy<C>;
  access?: AccessStrategy<C>;
}): DialogDefinition<C, State, View, Services> {
  const initial = definition.initial ?? Object.keys(definition.windows)[0];
  if (initial === undefined) {
    throw new Error(
      `Dialog '${definition.id}' must contain at least one window`,
    );
  }
  return { kind: "dialog", ...definition, initial };
}

/** A full dialog or a standalone window accepted by the runtime registry. */
export type DialogResource<C extends Context = Context> =
  | DialogDefinition<C, any, any, any>
  | WindowDefinition<C, any, any, any>;
