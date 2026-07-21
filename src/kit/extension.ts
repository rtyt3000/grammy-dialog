import type { Context } from "grammy";
import { createViewModelFactory, window } from "../core.js";
import type {
  DialogCatalog,
  DialogExtension,
  DialogExtensionContribution,
  WindowCatalog,
} from "./contracts.js";
import {
  createDialogFactory,
  type DialogDefinitionDsl,
  type WindowFactory,
} from "./definition-dsl.js";
import { access, scopes } from "../policies/scope-access.js";

/** DSL exposed to context-independent third-party extension definitions. */
export interface StandaloneExtensionContext
  extends DialogDefinitionDsl<Context, unknown> {
  readonly scope: typeof scopes;
  readonly access: typeof access;
}

/**
 * Defines a context-independent extension, typically in a third-party package.
 * Application-specific reusable plugins may use `kit.extension()` to receive the
 * application's types. Ordinary dialogs and windows should use `kit.define()`.
 */
export function defineDialogExtension<
  Dialogs extends DialogCatalog = {},
  Windows extends WindowCatalog = {},
>(
  factory: (
    context: StandaloneExtensionContext,
  ) => DialogExtensionContribution<Dialogs, Windows>,
  options: { readonly name?: string } = {},
): DialogExtension<Dialogs, Windows> {
  const context: StandaloneExtensionContext = {
    viewModel: createViewModelFactory<Context, unknown>(),
    window: window as WindowFactory<Context, unknown>,
    dialog: createDialogFactory(window as WindowFactory<Context, unknown>),
    scope: scopes,
    access,
  };
  return Object.freeze({
    name: options.name,
    contribution: freezeContribution(factory(context)),
  });
}

/** Freezes extension catalogs while preserving the inferred contribution type. */
export function freezeContribution<
  Dialogs extends DialogCatalog,
  Windows extends WindowCatalog,
>(
  contribution: DialogExtensionContribution<Dialogs, Windows>,
): DialogExtensionContribution<Dialogs, Windows> {
  return Object.freeze({
    dialogs: Object.freeze({ ...(contribution.dialogs ?? {}) }) as Dialogs,
    windows: Object.freeze({ ...(contribution.windows ?? {}) }) as Windows,
  });
}
