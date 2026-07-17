import type { Context } from "grammy";
import {
  defineDialog,
  type DialogDefinition,
  type AccessStrategy,
  type ScopeStrategy,
  type ViewModelDefinition,
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
import type { BuiltInUiCatalog } from "./built-in-widgets.js";

/** Low-level constructors available to extension authors. */
export interface WidgetDefinitionDsl {
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

/** Creates a dialog-local window bound to the dialog's ViewModel. */
export interface DialogWindowFactory<C extends Context, State, View, Services> {
  (
    id: string,
    definition: Omit<
      WindowDefinition<C, State, View, Services>,
      "kind" | "id" | "viewModel"
    >,
  ): WindowDefinition<C, State, View, Services>;
}

/** Values available while declaring windows owned by one dialog. */
export interface DialogWindowsContext<
  C extends Context,
  State,
  View,
  Services,
  Widgets extends Readonly<Record<string, unknown>>,
> {
  readonly window: DialogWindowFactory<C, State, View, Services>;
  readonly widgets: Widgets;
  readonly ui: BuiltInUiCatalog;
}

/** Context-bound dialog factory exposed by a DialogKit. */
export interface DialogFactory<
  C extends Context,
  Services,
  Widgets extends Readonly<Record<string, unknown>>,
> {
  /** Creates a dialog with one ViewModel shared by all of its windows. */
  <State, View>(
    id: string,
    definition: {
      readonly viewModel: ViewModelDefinition<State, View, C, Services>;
      readonly windows: (
        context: DialogWindowsContext<C, State, View, Services, Widgets>,
      ) => Readonly<Record<string, WindowDefinition<C, State, View, Services>>>;
      readonly initial?: string;
      readonly scope?: ScopeStrategy<C>;
      readonly access?: AccessStrategy<C>;
    },
  ): DialogDefinition<C, State, View, Services>;

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
  windowFactory: WindowFactory<C, Services>,
  widgets: Widgets,
  ui: BuiltInUiCatalog,
): DialogFactory<C, Services, Widgets> {
  return ((
    definitionOrId: string,
    builder?: {
      readonly viewModel: ViewModelDefinition<any, any, C, Services>;
      readonly windows: (
        context: DialogWindowsContext<C, any, any, Services, Widgets>,
      ) => Readonly<Record<string, WindowDefinition<C, any, any, Services>>>;
      readonly initial?: string;
      readonly scope?: ScopeStrategy<C>;
      readonly access?: AccessStrategy<C>;
    },
  ) => {
    if (builder === undefined) throw new TypeError("A nested dialog requires a definition");
    const dialogViewModel = builder.viewModel;
    const localWindow = ((localId: string, definition: object) =>
      windowFactory(`${definitionOrId}.${localId}`, {
        ...definition,
        viewModel: dialogViewModel,
      } as never)) as DialogWindowFactory<C, any, any, Services>;
    return defineDialog({
      id: definitionOrId,
      viewModel: dialogViewModel,
      windows: builder.windows({ window: localWindow, widgets, ui }),
      initial: builder.initial,
      scope: builder.scope,
      access: builder.access,
    });
  }) as DialogFactory<C, Services, Widgets>;
}

/** Shared low-level definition DSL used by kits and standalone extensions. */
export const widgetDefinitionDsl: WidgetDefinitionDsl = Object.freeze({
  widget: Object.freeze({
    text: defineTextWidget,
    media: defineMediaWidget,
    input: defineInputWidget,
    keyboard: defineKeyboardWidget,
    layout: defineKeyboardLayout,
  }),
});
