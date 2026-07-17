import type { Context } from "grammy";
import { createViewModelFactory, window } from "../core.js";
import { builtInWidgets, type BuiltInWidgetCatalog } from "./built-in-widgets.js";
import type {
  DialogCatalog,
  DialogExtension,
  DialogExtensionContribution,
  WidgetCatalog,
  WindowCatalog,
} from "./contracts.js";
import {
  widgetDefinitionDsl,
  createDialogFactory,
  type DialogDefinitionDsl,
  type WidgetDefinitionDsl,
  type WindowFactory,
} from "./definition-dsl.js";

/** DSL exposed to context-independent third-party extension definitions. */
export interface StandaloneExtensionContext extends DialogDefinitionDsl<
  Context,
  unknown,
  BuiltInWidgetCatalog
> {
  /** Built-in widgets available to every kit. */
  readonly widgets: BuiltInWidgetCatalog;
  /** Low-level factories for defining additional widgets. */
  readonly define: WidgetDefinitionDsl;
}

/**
 * Defines a context-independent extension, typically in a third-party package.
 * Application-specific reusable plugins may use `kit.extension()` to receive the
 * application's types. Ordinary dialogs and windows should use `kit.compose()`.
 */
export function defineDialogExtension<
  Widgets extends WidgetCatalog = {},
  Dialogs extends DialogCatalog = {},
  Windows extends WindowCatalog = {},
>(
  factory: (
    context: StandaloneExtensionContext,
  ) => DialogExtensionContribution<Widgets, Dialogs, Windows>,
  options: { readonly name?: string } = {},
): DialogExtension<Widgets, Dialogs, Windows> {
  const context: StandaloneExtensionContext = {
    viewModel: createViewModelFactory<Context, unknown>(),
    window: window as WindowFactory<Context, unknown>,
    dialog: createDialogFactory(
      createViewModelFactory<Context, unknown>(),
      window as WindowFactory<Context, unknown>,
      builtInWidgets,
    ),
    widgets: builtInWidgets,
    define: widgetDefinitionDsl,
  };
  return Object.freeze({
    name: options.name,
    contribution: freezeContribution(factory(context)),
  });
}

/** Freezes extension catalogs while preserving the inferred contribution type. */
export function freezeContribution<
  Widgets extends WidgetCatalog,
  Dialogs extends DialogCatalog,
  Windows extends WindowCatalog,
>(
  contribution: DialogExtensionContribution<Widgets, Dialogs, Windows>,
): DialogExtensionContribution<Widgets, Dialogs, Windows> {
  return Object.freeze({
    widgets: Object.freeze({ ...(contribution.widgets ?? {}) }) as Widgets,
    dialogs: Object.freeze({ ...(contribution.dialogs ?? {}) }) as Dialogs,
    windows: Object.freeze({ ...(contribution.windows ?? {}) }) as Windows,
  });
}
