import type { Context } from "grammy";
import type {
  Awaitable,
  CustomInputDefinition,
  KeyboardDefinition,
  KeyboardWidgetDefinition,
  KeyboardWidgetInstance,
  PhotoDefinition,
  RenderContext,
  TextSource,
  WidgetActionHandler,
} from "./core.js";

export interface TextWidgetFactory<Props> {
  <C extends Context = Context, View = unknown, Services = unknown>(definition: {
    render(context: RenderContext<C, View, Services> & { readonly props: Props }): Awaitable<string>;
  }): (props: Props) => TextSource<C, View, Services>;
}

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

export interface MediaWidgetFactory<Props> {
  <C extends Context = Context, View = unknown, Services = unknown>(definition: {
    render(
      context: RenderContext<C, View, Services> & { readonly props: Props },
    ): Awaitable<PhotoDefinition<C, View, Services> | undefined>;
  }): (
    props: Props,
  ) => (
    context: RenderContext<C, View, Services>,
  ) => Awaitable<PhotoDefinition<C, View, Services> | undefined>;
}

export function defineMediaWidget<Props>(): MediaWidgetFactory<Props> {
  return function define<
    C extends Context = Context,
    View = unknown,
    Services = unknown,
  >(definition: {
    render(
      context: RenderContext<C, View, Services> & { readonly props: Props },
    ): Awaitable<PhotoDefinition<C, View, Services> | undefined>;
  }) {
    return (props: Props) => (context: RenderContext<C, View, Services>) =>
      definition.render({ ...context, props });
  };
}

export interface InputWidgetFactory<Props, Value> {
  <C extends Context = Context>(definition: {
    match(ctx: C, props: Props): Awaitable<boolean>;
    parse(ctx: C, props: Props): Awaitable<Value>;
    validate?: (value: Value, props: Props) => Awaitable<import("./core.js").InputValidation<Value>>;
  }): (
    props: Props & { readonly id: string; readonly onReceive: string },
  ) => CustomInputDefinition<C, Value>;
}

export function defineInputWidget<Props, Value>(): InputWidgetFactory<Props, Value> {
  return function define<C extends Context = Context>(definition: {
    match(ctx: C, props: Props): Awaitable<boolean>;
    parse(ctx: C, props: Props): Awaitable<Value>;
    validate?: (value: Value, props: Props) => Awaitable<import("./core.js").InputValidation<Value>>;
  }) {
    return (
      props: Props & { readonly id: string; readonly onReceive: string },
    ): CustomInputDefinition<C, Value> => {
      const { id, onReceive, ...inputProps } = props;
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
    definition: KeyboardWidgetDefinition<C, View, Services, Props, State, Actions>,
  ): (
    props: Props & { readonly id: string },
  ) => KeyboardWidgetInstance<C, View, Services, Props, State>;
}

export function defineKeyboardWidget<Props, State>(): KeyboardWidgetFactory<Props, State> {
  return (function define<
    C extends Context = Context,
    View = unknown,
    Services = unknown,
    Actions extends Record<string, WidgetActionHandler<C, Props, State, Services>> = Record<
      string,
      WidgetActionHandler<C, Props, State, Services>
    >,
  >(definition: KeyboardWidgetDefinition<C, View, Services, Props, State, Actions>) {
    return (
      props: Props & { readonly id: string },
    ): KeyboardWidgetInstance<C, View, Services, Props, State> => {
      const { id, ...widgetProps } = props;
      return {
        kind: "keyboard-widget",
        id,
        props: widgetProps as Props,
        definition,
      };
    };
  }) as KeyboardWidgetFactory<Props, State>;
}

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
