import type { Context } from "grammy";
import type { ButtonAction, NavigationController, WidgetAction } from "./actions.js";
import type { Awaitable, StateHandle } from "./common.js";
import type { RenderContext, TextSource } from "./rendering.js";

/** Callback button that invokes an intent, navigation, or widget action. */
export interface ButtonDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "callback";
  readonly id?: string;
  readonly text: TextSource<C, View, Services>;
  readonly action: ButtonAction;
}

/** Inline keyboard button that opens a URL. */
export interface UrlButtonDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "url";
  readonly text: TextSource<C, View, Services>;
  readonly url: string | ((context: RenderContext<C, View, Services>) => Awaitable<string>);
}

/** Any button accepted in an inline keyboard row. */
export type KeyboardButtonDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = ButtonDefinition<C, View, Services> | UrlButtonDefinition<C, View, Services>;

/** Creates a callback button; its stable id is inferred from its row position. */
export function button<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  action: string | ButtonAction,
): ButtonDefinition<C, View, Services>;
/** Creates a callback button with an explicit stable id. */
export function button<C extends Context = Context, View = unknown, Services = unknown>(
  id: string,
  text: TextSource<C, View, Services>,
  action: string | ButtonAction,
): ButtonDefinition<C, View, Services>;
export function button<C extends Context = Context, View = unknown, Services = unknown>(
  first: string | TextSource<C, View, Services>,
  second: string | ButtonAction | TextSource<C, View, Services>,
  third?: string | ButtonAction,
): ButtonDefinition<C, View, Services> {
  const hasExplicitId = third !== undefined;
  const action = (hasExplicitId ? third : second) as string | ButtonAction;
  return {
    kind: "callback",
    id: hasExplicitId ? String(first) : undefined,
    text: (hasExplicitId ? second : first) as TextSource<C, View, Services>,
    action: typeof action === "string" ? { kind: "intent", name: action } : action,
  };
}

/** Creates an inline URL button. */
export function urlButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  url: UrlButtonDefinition<C, View, Services>["url"],
): UrlButtonDefinition<C, View, Services> {
  return { kind: "url", text, url };
}

/** Rows of Telegram inline keyboard button definitions. */
export type KeyboardDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = ReadonlyArray<ReadonlyArray<KeyboardButtonDefinition<C, View, Services>>>;

/** Values available to an action declared by a stateful keyboard widget. */
export interface WidgetActionContext<C extends Context, Props, State, Services> {
  readonly ctx: C;
  readonly props: Props;
  readonly state: StateHandle<State>;
  readonly services: Services;
  readonly navigation: NavigationController;
  readonly payload: unknown;
}

/** Handler for one named keyboard widget action. */
export type WidgetActionHandler<
  C extends Context = Context,
  Props = unknown,
  State = unknown,
  Services = unknown,
> = (context: WidgetActionContext<C, Props, State, Services>) => Awaitable<void>;

/** Type-safe action creators exposed to a keyboard widget renderer. */
export type WidgetActions<Actions extends Record<string, WidgetActionHandler<any, any, any, any>>> = {
  readonly [Key in keyof Actions]: (payload?: unknown) => WidgetAction;
};

/** Render context extended with the current keyboard widget state and actions. */
export interface KeyboardWidgetRenderContext<
  C extends Context,
  View,
  Services,
  Props,
  State,
  Actions extends Record<string, WidgetActionHandler<C, Props, State, Services>>,
> extends RenderContext<C, View, Services> {
  readonly props: Props;
  readonly state: StateHandle<State>;
  readonly actions: WidgetActions<Actions>;
}

/** Normalized runtime definition of a stateful keyboard widget. */
export interface KeyboardWidgetDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Props = unknown,
  State = unknown,
  Actions extends Record<string, WidgetActionHandler<C, Props, State, Services>> = Record<
    string,
    WidgetActionHandler<C, Props, State, Services>
  >,
> {
  readonly state: {
    readonly version: number;
    readonly initial: (props: Props) => State;
  };
  readonly actions: Actions;
  readonly render: (
    context: KeyboardWidgetRenderContext<C, View, Services, Props, State, Actions>,
  ) => Awaitable<KeyboardDefinition<C, View, Services>>;
}

/** User-facing keyboard widget options; state schema version defaults to `1`. */
export type KeyboardWidgetOptions<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Props = unknown,
  State = unknown,
  Actions extends Record<string, WidgetActionHandler<C, Props, State, Services>> = Record<
    string,
    WidgetActionHandler<C, Props, State, Services>
  >,
> = Omit<
  KeyboardWidgetDefinition<C, View, Services, Props, State, Actions>,
  "state"
> & {
  readonly state: {
    readonly version?: number;
    readonly initial: (props: Props) => State;
  };
};

/** A mounted keyboard widget with a stable state namespace id. */
export interface KeyboardWidgetInstance<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Props = unknown,
  State = unknown,
> {
  readonly kind: "keyboard-widget";
  readonly id: string;
  readonly props: Props;
  readonly definition: KeyboardWidgetDefinition<C, View, Services, Props, State, any>;
}

/** A raw inline keyboard or a mounted stateful keyboard widget. */
export type KeyboardNode<C extends Context = Context, View = unknown, Services = unknown> =
  | KeyboardDefinition<C, View, Services>
  | KeyboardWidgetInstance<C, View, Services, any, any>;

/** Static keyboard content or a render-time keyboard resolver. */
export type KeyboardSource<C extends Context = Context, View = unknown, Services = unknown> =
  | KeyboardNode<C, View, Services>
  | ((context: RenderContext<C, View, Services>) => Awaitable<KeyboardNode<C, View, Services>>);
