import type { Context } from "grammy";
import {
  button,
  defineDialog,
  urlButton,
  type DialogDefinition,
  type AccessStrategy,
  type ScopeStrategy,
  type ViewModelFactory,
  type WindowDefinition,
} from "../core.js";
import {
  defineInputWidget,
  defineKeyboardLayout,
  defineKeyboardWidget,
  defineMediaWidget,
  defineTextWidget,
} from "../widgets.js";

/** Low-level constructors available to extension authors. */
export interface WidgetDefinitionDsl {
  readonly button: typeof button;
  readonly urlButton: typeof urlButton;
  readonly widget: {
    readonly text: typeof defineTextWidget;
    readonly media: typeof defineMediaWidget;
    readonly input: typeof defineInputWidget;
    readonly keyboard: typeof defineKeyboardWidget;
    readonly layout: typeof defineKeyboardLayout;
  };
}

/** Application-bound factories used to define ViewModels and resources. */
export interface WindowFactory<C extends Context, Services> {
  /** Creates a window backed by a ViewModel from the same application DSL. */
  <State, View>(
    id: string,
    definition: Omit<WindowDefinition<C, State, View, Services>, "kind" | "id">,
  ): WindowDefinition<C, State, View, Services>;

  /** Creates a static window with typed context and application services. */
  (
    id: string,
    definition: Omit<
      WindowDefinition<C, {}, {}, Services>,
      "kind" | "id" | "viewModel"
    > & { readonly viewModel?: undefined },
  ): WindowDefinition<C, {}, {}, Services>;
}

/** Factories available while defining the contents of one dialog. */
export interface DialogBuilderContext<
  C extends Context,
  Services,
  Widgets extends Readonly<Record<string, unknown>>,
> {
  readonly viewModel: ViewModelFactory<C, Services>;
  /** Creates a window whose runtime id is automatically prefixed by the dialog id. */
  readonly window: WindowFactory<C, Services>;
  /** Built-in and installed third-party widgets available to this dialog. */
  readonly widgets: Widgets;
}

/** Result returned by a nested dialog builder. */
export interface DialogBuilderResult<C extends Context> {
  readonly initial?: string;
  readonly windows: Readonly<Record<string, WindowDefinition<C, any, any, any>>>;
  readonly scope?: ScopeStrategy<C>;
  readonly access?: AccessStrategy<C>;
}

/** Context-bound dialog factory exposed by a DialogKit. */
export interface DialogFactory<
  C extends Context,
  Services,
  Widgets extends Readonly<Record<string, unknown>>,
> {
  /** Creates a dialog with nested ViewModel and local-window factories. */
  (
    id: string,
    builder: (context: DialogBuilderContext<C, Services, Widgets>) => DialogBuilderResult<C>,
  ): DialogDefinition<C>;

  /** Creates a dialog from an already assembled definition. */
  (definition: {
    id: string;
    initial?: string;
    windows: Readonly<Record<string, WindowDefinition<C, any, any, any>>>;
    scope?: DialogDefinition<C>["scope"];
    access?: DialogDefinition<C>["access"];
  }): DialogDefinition<C>;
}

/** Application-bound factories used to define ViewModels and resources. */
export interface DialogDefinitionDsl<
  C extends Context,
  Services,
  Widgets extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  readonly viewModel: ViewModelFactory<C, Services>;
  readonly window: WindowFactory<C, Services>;
  readonly dialog: DialogFactory<C, Services, Widgets>;
}

/** Creates the nested dialog factory used by kits and extension DSLs. */
export function createDialogFactory<
  C extends Context,
  Services,
  Widgets extends Readonly<Record<string, unknown>>,
>(
  viewModel: ViewModelFactory<C, Services>,
  windowFactory: WindowFactory<C, Services>,
  widgets: Widgets,
): DialogFactory<C, Services, Widgets> {
  return ((
    definitionOrId: string | Parameters<typeof defineDialog>[0],
    builder?: (
      context: DialogBuilderContext<C, Services, Widgets>,
    ) => DialogBuilderResult<C>,
  ) => {
    if (typeof definitionOrId !== "string") return defineDialog(definitionOrId);
    if (builder === undefined) throw new TypeError("A nested dialog requires a builder");
    const localWindow = ((localId: string, definition: unknown) =>
      windowFactory(`${definitionOrId}.${localId}`, definition as never)) as WindowFactory<C, Services>;
    return defineDialog({
      id: definitionOrId,
      ...builder({ viewModel, window: localWindow, widgets }),
    });
  }) as DialogFactory<C, Services, Widgets>;
}

/** Shared low-level definition DSL used by kits and standalone extensions. */
export const widgetDefinitionDsl: WidgetDefinitionDsl = Object.freeze({
  button,
  urlButton,
  widget: Object.freeze({
    text: defineTextWidget,
    media: defineMediaWidget,
    input: defineInputWidget,
    keyboard: defineKeyboardWidget,
    layout: defineKeyboardLayout,
  }),
});
