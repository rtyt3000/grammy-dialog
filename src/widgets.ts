import type { Context } from "grammy";
import type {
  Awaitable,
  CustomInputDefinition,
  KeyboardDefinition,
  KeyboardWidgetDefinition,
  KeyboardWidgetInstance,
  KeyboardWidgetOptions,
  MediaDefinition,
  MediaKind,
  RenderContext,
  TextSource,
  WidgetActionHandler,
} from "./core.js";
import type { IntentReference } from "./definitions/view-model.js";

/** Curried factory used to define a reusable text widget with typed props. */
export interface TextWidgetFactory<Props> {
  <C extends Context = Context, View = unknown, Services = unknown>(definition: {
    render(context: RenderContext<C, View, Services> & { readonly props: Props }): Awaitable<string>;
  }): (props: Props) => TextSource<C, View, Services>;
}

/** Starts definition of a reusable render-only text widget. */
export function defineTextWidget<Props>(): TextWidgetFactory<Props> {
  return (function define<
    C extends Context = Context,
    View = unknown,
    Services = unknown,
  >(definition: {
    render(context: RenderContext<C, View, Services> & { readonly props: Props }): Awaitable<string>;
  }) {
    return (props: Props): TextSource<C, View, Services> => context =>
      definition.render({ ...context, props });
  }) as TextWidgetFactory<Props>;
}

/** Curried factory used to define a reusable media widget with typed props. */
export interface MediaWidgetFactory<Props> {
  <C extends Context = Context, View = unknown, Services = unknown>(definition: {
    render(
      context: RenderContext<C, View, Services> & { readonly props: Props },
    ): Awaitable<MediaDefinition<MediaKind, C, View, Services> | undefined>;
  }): (
    props: Props,
  ) => (
    context: RenderContext<C, View, Services>,
  ) => Awaitable<MediaDefinition<MediaKind, C, View, Services> | undefined>;
}

/** Starts definition of a media widget that may omit media for a render. */
export function defineMediaWidget<Props>(): MediaWidgetFactory<Props> {
  return function define<
    C extends Context = Context,
    View = unknown,
    Services = unknown,
  >(definition: {
    render(
      context: RenderContext<C, View, Services> & { readonly props: Props },
    ): Awaitable<MediaDefinition<MediaKind, C, View, Services> | undefined>;
  }) {
    return (props: Props) => (context: RenderContext<C, View, Services>) =>
      definition.render({ ...context, props });
  };
}

/** Curried factory used to define a custom input parser with typed props and value. */
export interface InputWidgetFactory<Props, Value> {
  <C extends Context = Context>(definition: {
    match(ctx: C, props: Props): Awaitable<boolean>;
    parse(ctx: C, props: Props): Awaitable<Value>;
    validate?: (value: Value, props: Props) => Awaitable<import("./core.js").InputValidation<Value>>;
  }): (
    id: string,
    intent: IntentReference<any, Value>,
    props: Props,
  ) => CustomInputDefinition<C, Value>;
}

/**
 * Starts definition of a custom input widget mounted with a typed intent reference.
 */
export function defineInputWidget<Props, Value>(): InputWidgetFactory<Props, Value> {
  return function define<C extends Context = Context>(definition: {
    match(ctx: C, props: Props): Awaitable<boolean>;
    parse(ctx: C, props: Props): Awaitable<Value>;
    validate?: (value: Value, props: Props) => Awaitable<import("./core.js").InputValidation<Value>>;
  }) {
    return (
      id: string,
      intent: IntentReference<any, Value>,
      props: Props,
    ): CustomInputDefinition<C, Value> => {
      return {
        kind: "custom",
        id,
        onReceive: intent.name,
        match: ctx => definition.match(ctx, props),
        parse: ctx => definition.parse(ctx, props),
        validate: definition.validate === undefined
          ? undefined
          : value => definition.validate!(value, props),
      };
    };
  };
}

/** Curried factory used to define a stateful keyboard widget. */
export interface KeyboardWidgetFactory<Props, State> {
  <
    C extends Context = Context,
    View = unknown,
    Services = unknown,
    Actions extends Record<string, WidgetActionHandler<C, Props, State, Services, any>> = Record<
      string,
      WidgetActionHandler<C, Props, State, Services, any>
    >,
  >(
    definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
  ): (
    id: string,
    props: Props,
  ) => KeyboardWidgetInstance<C, View, Services, Props, State>;
}

/** Defines a stateful keyboard widget while inferring props and state. */
export function defineKeyboardWidget<
  Props,
  State,
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Actions extends Record<string, WidgetActionHandler<C, Props, State, Services, any>> = Record<
    string,
    WidgetActionHandler<C, Props, State, Services, any>
  >,
>(
  definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
): (
  id: string,
  props: Props,
) => KeyboardWidgetInstance<C, View, Services, Props, State>;
/** Starts a curried definition when props and state are supplied explicitly. */
export function defineKeyboardWidget<Props, State>(): KeyboardWidgetFactory<Props, State>;
export function defineKeyboardWidget(
  definition?: KeyboardWidgetOptions<any, any, any, any, any, any>,
): unknown {
  const define = function define<
    Props,
    State,
    C extends Context = Context,
    View = unknown,
    Services = unknown,
    Actions extends Record<string, WidgetActionHandler<C, Props, State, Services, any>> = Record<
      string,
      WidgetActionHandler<C, Props, State, Services, any>
    >,
  >(options: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>) {
    const normalized: KeyboardWidgetDefinition<C, View, Services, Props, State, Actions> = {
      ...options,
      state: {
        version: options.state.version ?? 1,
        initial: options.state.initial,
        migrate: options.state.migrate,
      },
      actions: options.actions,
    };
    return (
      id: string,
      props: Props,
    ): KeyboardWidgetInstance<C, View, Services, Props, State> => {
      return {
        kind: "keyboard-widget",
        id,
        props,
        definition: normalized,
      };
    };
  };
  return definition === undefined ? define : define(definition);
}

/** Curried factory used to define a reusable stateless keyboard layout. */
export interface KeyboardLayoutFactory<Props> {
  <C extends Context = Context, View = unknown, Services = unknown>(definition: {
    render(
      context: RenderContext<C, View, Services> & { readonly props: Props },
    ): Awaitable<KeyboardDefinition<C, View, Services>>;
  }): (
    props: Props,
  ) => (
    context: RenderContext<C, View, Services>,
  ) => Awaitable<KeyboardDefinition<C, View, Services>>;
}

/** Starts definition of a stateless inline keyboard layout. */
export function defineKeyboardLayout<Props>(): KeyboardLayoutFactory<Props> {
  return function define<
    C extends Context = Context,
    View = unknown,
    Services = unknown,
  >(definition: {
    render(
      context: RenderContext<C, View, Services> & { readonly props: Props },
    ): Awaitable<KeyboardDefinition<C, View, Services>>;
  }) {
    return (props: Props) => (context: RenderContext<C, View, Services>) =>
      definition.render({ ...context, props });
  };
}
