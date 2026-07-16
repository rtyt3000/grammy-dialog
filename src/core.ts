import type { Context, InputFile } from "grammy";

export type Awaitable<T> = T | Promise<T>;

export interface Translation {
  readonly kind: "translation";
  readonly key: string;
  readonly params?: Record<string, unknown>;
}

export function t(
  key: string,
  params?: Record<string, unknown>,
): Translation {
  return { kind: "translation", key, params };
}

export interface TranslationAdapter {
  translate(
    locale: string,
    key: string,
    params?: Record<string, unknown>,
  ): Awaitable<string>;
}

export interface LocaleResolver<C extends Context = Context> {
  resolve(ctx: C): Awaitable<string>;
}

export interface ScopeResolution {
  readonly key: string;
  readonly chatId: number;
  readonly threadId?: number;
}

export interface ScopeStrategy<C extends Context = Context> {
  readonly id: string;
  resolve(ctx: C): Awaitable<ScopeResolution>;
}

export interface AccessInstance {
  readonly id: string;
  readonly ownerId?: number;
  readonly chatId: number;
  readonly threadId?: number;
}

export interface AccessStrategy<C extends Context = Context> {
  readonly id: string;
  allows(ctx: C, instance: AccessInstance): Awaitable<boolean>;
}

export interface RenderContext<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly ctx: C | undefined;
  readonly vm: View;
  readonly services: Services;
  readonly locale: string;
  readonly t: (
    key: string,
    params?: Record<string, unknown>,
  ) => Awaitable<string>;
}

export type TextSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | string
  | Translation
  | ((context: RenderContext<C, View, Services>) => Awaitable<string | Translation>);

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

export function urlButton<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
>(
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

export interface WidgetActionContext<
  C extends Context,
  Props,
  State,
  Services,
> {
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

export type KeyboardNode<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> = KeyboardDefinition<C, View, Services> | KeyboardWidgetInstance<C, View, Services, any, any>;

export type KeyboardSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | KeyboardNode<C, View, Services>
  | ((context: RenderContext<C, View, Services>) => Awaitable<KeyboardNode<C, View, Services>>);

export type PhotoSource<C extends Context = Context, View = unknown, Services = unknown> =
  | string
  | InputFile
  | ((context: RenderContext<C, View, Services>) => Awaitable<string | InputFile | undefined>);

export interface PhotoDefinition<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> {
  readonly kind: "photo";
  readonly source: PhotoSource<C, View, Services>;
}

export type MediaSource<
  C extends Context = Context,
  View = unknown,
  Services = unknown,
> =
  | PhotoDefinition<C, View, Services>
  | ((context: RenderContext<C, View, Services>) => Awaitable<PhotoDefinition<C, View, Services> | undefined>);

export function photo<C extends Context = Context, View = unknown, Services = unknown>(
  source: PhotoSource<C, View, Services>,
): PhotoDefinition<C, View, Services> {
  return { kind: "photo", source };
}

export interface InputValidationSuccess<Value> {
  readonly ok: true;
  readonly value: Value;
}

export interface InputValidationFailure {
  readonly ok: false;
  readonly message?: TextSource;
}

export type InputValidation<Value> = InputValidationSuccess<Value> | InputValidationFailure;

export function valid<Value>(value: Value): InputValidationSuccess<Value> {
  return { ok: true, value };
}

export function invalid(message?: TextSource): InputValidationFailure {
  return { ok: false, message };
}

export interface TextInputDefinition {
  readonly kind: "text";
  readonly id: string;
  readonly trim: boolean;
  readonly onReceive: string;
  readonly validate?: (value: string) => Awaitable<InputValidation<string>>;
}

export function textInput(
  id: string,
  options: {
    onReceive: string;
    trim?: boolean;
    validate?: TextInputDefinition["validate"];
  },
): TextInputDefinition {
  return {
    kind: "text",
    id,
    trim: options.trim ?? false,
    onReceive: options.onReceive,
    validate: options.validate,
  };
}

export interface PhotoInputValue {
  fileId: string;
  fileUniqueId: string;
  width: number;
  height: number;
  fileSize?: number;
  caption?: string;
  messageId: number;
}

export interface PhotoInputDefinition {
  readonly kind: "photo";
  readonly id: string;
  readonly onReceive: string;
}

export function photoInput(
  id: string,
  options: { onReceive: string },
): PhotoInputDefinition {
  return { kind: "photo", id, onReceive: options.onReceive };
}

export interface CustomInputDefinition<
  C extends Context = Context,
  Value = unknown,
> {
  readonly kind: "custom";
  readonly id: string;
  readonly onReceive: string;
  readonly match: (ctx: C) => Awaitable<boolean>;
  readonly parse: (ctx: C) => Awaitable<Value>;
  readonly validate?: (value: Value) => Awaitable<InputValidation<Value>>;
}

export type InputDefinition<C extends Context = Context> =
  | TextInputDefinition
  | PhotoInputDefinition
  | CustomInputDefinition<C, any>;

export interface ViewModelLoadContext<
  C extends Context,
  State,
  Services,
> {
  readonly ctx: C | undefined;
  readonly state: State;
  readonly services: Services;
  readonly actor: { id?: number; chatId: number };
}

export interface NavigationController {
  go(windowId: string, data?: unknown): void;
  replace(windowId: string, data?: unknown): void;
  back(): void;
  reset(windowId: string, data?: unknown): void;
  close(result?: unknown): void;
}

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

export type IntentHandler<
  C extends Context = Context,
  State = unknown,
  View = unknown,
  Services = unknown,
> = (context: IntentContext<C, State, View, Services, any, any>) => Awaitable<void>;

export interface ViewModelDefinition<
  State = unknown,
  View = unknown,
  C extends Context = Context,
  Services = unknown,
  Intents extends Record<string, IntentHandler<C, State, View, Services>> = Record<
    string,
    IntentHandler<C, State, View, Services>
  >,
> {
  readonly initialState: () => State;
  readonly load: (context: ViewModelLoadContext<C, State, Services>) => Awaitable<View>;
  readonly intents: Intents;
}

export function viewModel<
  State,
  View,
  C extends Context = Context,
  Services = unknown,
  Intents extends Record<string, IntentHandler<C, State, View, Services>> = Record<
    string,
    IntentHandler<C, State, View, Services>
  >,
>(definition: {
  initialState: State | (() => State);
  load: (context: ViewModelLoadContext<C, State, Services>) => Awaitable<View>;
  intents: Intents;
}): ViewModelDefinition<State, View, C, Services, Intents> {
  const initialState = definition.initialState;
  return {
    ...definition,
    initialState: typeof initialState === "function"
      ? initialState as () => State
      : () => structuredClone(initialState as State),
  };
}

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
): WindowDefinition<C, State, View, Services> {
  return { kind: "window", id, ...definition };
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
  initial: string;
  windows: Readonly<Record<string, WindowDefinition<C, any, any, any>>>;
  scope?: ScopeStrategy<C>;
  access?: AccessStrategy<C>;
}): DialogDefinition<C> {
  return { kind: "dialog", ...definition };
}

export type DialogResource<C extends Context = Context> =
  | DialogDefinition<C>
  | WindowDefinition<C, any, any, any>;
