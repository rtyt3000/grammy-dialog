import type { Context } from "grammy";
import type { ButtonAction, NavigationController, WidgetAction } from "./actions.js";
import type { Awaitable, StateHandle } from "./common.js";
import type { RenderContext, TextSource } from "./rendering.js";

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

export interface UrlButtonDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "url";
  readonly text: TextSource<C, View, Services>;
  readonly url: string | ((context: RenderContext<C, View, Services>) => Awaitable<string>);
}

export type KeyboardButtonDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = ButtonDefinition<C, View, Services> | UrlButtonDefinition<C, View, Services>;

export function button<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  action: string | ButtonAction,
): ButtonDefinition<C, View, Services>;
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

export function urlButton<C extends Context = Context, View = unknown, Services = unknown>(
  text: TextSource<C, View, Services>,
  url: UrlButtonDefinition<C, View, Services>["url"],
): UrlButtonDefinition<C, View, Services> {
  return { kind: "url", text, url };
}

export type KeyboardDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = ReadonlyArray<ReadonlyArray<KeyboardButtonDefinition<C, View, Services>>>;

export interface WidgetActionContext<C extends Context, Props, State, Services> {
  readonly ctx: C;
  readonly props: Props;
  readonly state: StateHandle<State>;
  readonly services: Services;
  readonly navigation: NavigationController;
  readonly payload: unknown;
}

export type WidgetActionHandler<
  C extends Context = Context,
  Props = unknown,
  State = unknown,
  Services = unknown,
> = (context: WidgetActionContext<C, Props, State, Services>) => Awaitable<void>;

export type WidgetActions<Actions extends Record<string, WidgetActionHandler<any, any, any, any>>> = {
  readonly [Key in keyof Actions]: (payload?: unknown) => WidgetAction;
};

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

export type KeyboardNode<C extends Context = Context, View = unknown, Services = unknown> =
  | KeyboardDefinition<C, View, Services>
  | KeyboardWidgetInstance<C, View, Services, any, any>;

export type KeyboardSource<C extends Context = Context, View = unknown, Services = unknown> =
  | KeyboardNode<C, View, Services>
  | ((context: RenderContext<C, View, Services>) => Awaitable<KeyboardNode<C, View, Services>>);
