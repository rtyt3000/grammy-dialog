import type { Context } from "grammy";
import type {
  Awaitable,
  CustomInputDefinition,
  KeyboardWidgetDefinition,
  KeyboardWidgetInstance,
  KeyboardWidgetOptions,
  WidgetActionHandler,
} from "./core.js";
import type { IntentReference } from "./definitions/view-model.js";
import { Widget } from "./jsx/elements.js";
import type { JsxElement } from "./jsx/types.js";

/** Curried factory used to define a custom input parser with typed props and value. */
export type InputWidgetFactory<Props, Value> = <
  C extends Context = Context,
>(definition: {
  match(ctx: C, props: Props): Awaitable<boolean>;
  parse(ctx: C, props: Props): Awaitable<Value>;
  validate?: (
    value: Value,
    props: Props,
  ) => Awaitable<import("./core.js").InputValidation<Value>>;
}) => (
  id: string,
  intent: IntentReference<any, Value>,
  props: Props,
) => CustomInputDefinition<C, Value>;

/**
 * Starts definition of a custom input widget mounted with a typed intent reference.
 */
export function defineInputWidget<Props, Value>(): InputWidgetFactory<
  Props,
  Value
> {
  return function define<C extends Context = Context>(definition: {
    match(ctx: C, props: Props): Awaitable<boolean>;
    parse(ctx: C, props: Props): Awaitable<Value>;
    validate?: (
      value: Value,
      props: Props,
    ) => Awaitable<import("./core.js").InputValidation<Value>>;
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
        match: (ctx) => definition.match(ctx, props),
        parse: (ctx) => definition.parse(ctx, props),
        validate:
          definition.validate === undefined
            ? undefined
            : (value) => definition.validate!(value, props),
      };
    };
  };
}

/** Curried factory used to define a stateful keyboard widget. */
export type KeyboardWidgetFactory<Props, State> = <
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Actions extends Record<
    string,
    WidgetActionHandler<C, Props, State, Services, any>
  > = Record<string, WidgetActionHandler<C, Props, State, Services, any>>,
>(
  definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
) => (
  id: string,
  props: Props,
) => KeyboardWidgetInstance<C, View, Services, Props, State>;

/** Defines a stateful keyboard widget while inferring props and state. */
export function defineKeyboardWidget<
  Props,
  State,
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Actions extends Record<
    string,
    WidgetActionHandler<C, Props, State, Services, any>
  > = Record<string, WidgetActionHandler<C, Props, State, Services, any>>,
>(
  definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
): (
  id: string,
  props: Props,
) => KeyboardWidgetInstance<C, View, Services, Props, State>;
/** Starts a curried definition when props and state are supplied explicitly. */
export function defineKeyboardWidget<Props, State>(): KeyboardWidgetFactory<
  Props,
  State
>;
export function defineKeyboardWidget(
  definition?: KeyboardWidgetOptions<any, any, any, any, any, any>,
): unknown {
  const define = function define<
    Props,
    State,
    C extends Context = Context,
    View = unknown,
    Services = unknown,
    Actions extends Record<
      string,
      WidgetActionHandler<C, Props, State, Services, any>
    > = Record<string, WidgetActionHandler<C, Props, State, Services, any>>,
  >(options: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>) {
    const normalized: KeyboardWidgetDefinition<
      C,
      View,
      Services,
      Props,
      State,
      Actions
    > = {
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

/** Props required by every stateful JSX widget mount. */
export interface WidgetMountProps {
  /** Stable namespace for persisted widget state inside the rendered keyboard tree. */
  readonly id: string;
}

/** JSX component produced by `defineWidget`. */
export type StatefulWidgetComponent<Props extends object> = (
  props: Props & WidgetMountProps,
) => JsxElement;

/** Curried factory used when widget props/state are supplied explicitly. */
export type StatefulWidgetFactory<Props extends object, State> = <
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Actions extends Record<
    string,
    WidgetActionHandler<C, Props, State, Services, any>
  > = Record<string, WidgetActionHandler<C, Props, State, Services, any>>,
>(
  definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
) => StatefulWidgetComponent<Props>;

/**
 * Defines a stateful JSX widget. The returned component is mounted directly in
 * a `<Keyboard>` and uses its `id` prop as the persisted state namespace.
 */
export function defineWidget<
  Props extends object,
  State,
  C extends Context = Context,
  View = unknown,
  Services = unknown,
  Actions extends Record<
    string,
    WidgetActionHandler<C, Props, State, Services, any>
  > = Record<string, WidgetActionHandler<C, Props, State, Services, any>>,
>(
  definition: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
): StatefulWidgetComponent<Props>;
/** Starts a curried widget definition when props and state are supplied explicitly. */
export function defineWidget<
  Props extends object,
  State,
>(): StatefulWidgetFactory<Props, State>;
export function defineWidget(
  definition?: KeyboardWidgetOptions<any, any, any, any, any, any>,
): unknown {
  const define = function define<
    Props extends object,
    State,
    C extends Context = Context,
    View = unknown,
    Services = unknown,
    Actions extends Record<
      string,
      WidgetActionHandler<C, Props, State, Services, any>
    > = Record<string, WidgetActionHandler<C, Props, State, Services, any>>,
  >(
    options: KeyboardWidgetOptions<C, View, Services, Props, State, Actions>,
  ): StatefulWidgetComponent<Props> {
    const factory = defineKeyboardWidget<
      Props,
      State,
      C,
      View,
      Services,
      Actions
    >(options);
    return (({ id, ...props }: Props & WidgetMountProps) =>
      Widget({
        instance: factory(id, props as Props),
      })) as StatefulWidgetComponent<Props>;
  };
  return definition === undefined ? define : define(definition);
}
