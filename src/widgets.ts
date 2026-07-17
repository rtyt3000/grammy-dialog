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
    props: Props & { readonly id: string; readonly onReceive?: string },
  ) => CustomInputDefinition<C, Value>;
}

/**
 * Starts definition of a custom input widget.
 * Mounted inputs use their `id` as `onReceive` unless it is overridden.
 */
export function defineInputWidget<Props, Value>(): InputWidgetFactory<Props, Value> {
  return function define<C extends Context = Context>(definition: {
    match(ctx: C, props: Props): Awaitable<boolean>;
    parse(ctx: C, props: Props): Awaitable<Value>;
    validate?: (value: Value, props: Props) => Awaitable<import("./core.js").InputValidation<Value>>;
  }) {
    return (
      props: Props & { readonly id: string; readonly onReceive?: string },
    ): CustomInputDefinition<C, Value> => {
      const { id, onReceive = id, ...inputProps } = props;
      const resolvedProps = inputProps as Props;
      return {
        kind: "custom",
        id,
        onReceive,
        match: ctx => definition.match(ctx, resolvedProps),
        parse: ctx => definition.parse(ctx, resolvedProps),
        validate: definition.validate === undefined
          ? undefined
          : value => definition.validate!(value, resolvedProps),
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
    Actions extends Record<string, WidgetActionHandler<C, Props, State, Services>> = Record<
      string,
      WidgetActionHandler<C, Props, State, Services>
    >,
  >(
    definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
  ): (
    props: Props & { readonly id: string },
  ) => KeyboardWidgetInstance<C, View, Services, Props, State>;
}

/**
 * Starts definition of a stateful keyboard widget.
 * Widget state is isolated by the mounted `id`; its schema version defaults to `1`.
 */
export function defineKeyboardWidget<Props, State>(): KeyboardWidgetFactory<Props, State> {
  return (function define<
    C extends Context = Context,
    View = unknown,
    Services = unknown,
    Actions extends Record<string, WidgetActionHandler<C, Props, State, Services>> = Record<
      string,
      WidgetActionHandler<C, Props, State, Services>
    >,
  >(definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>) {
    const normalized: KeyboardWidgetDefinition<C, View, Services, Props, State, Actions> = {
      ...definition,
      state: {
        version: definition.state.version ?? 1,
        initial: definition.state.initial,
      },
      actions: definition.actions,
    };
    return (
      props: Props & { readonly id: string },
    ): KeyboardWidgetInstance<C, View, Services, Props, State> => {
      const { id, ...widgetProps } = props;
      return {
        kind: "keyboard-widget",
        id,
        props: widgetProps as Props,
        definition: normalized,
      };
    };
  }) as KeyboardWidgetFactory<Props, State>;
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
