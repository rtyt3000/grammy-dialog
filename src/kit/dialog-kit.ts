import type { Context } from "grammy";
import {
  createViewModelFactory,
  window,
  type DialogDefinition,
  type WindowDefinition,
} from "../core.js";
import { dialogs } from "../integration/grammy-plugin.js";
import { DefinitionRegistry } from "../runtime/definition-registry.js";
import type {
  DialogCatalog,
  DialogExtension,
  DialogExtensionContext,
  DialogKit,
  DialogKitMiddlewareOptions,
  WindowCatalog,
} from "./contracts.js";
import { createDialogFactory, type WindowFactory } from "./definition-dsl.js";
import { freezeContribution } from "./extension.js";
import { access, scopes } from "../policies/scope-access.js";
import { inputRouting } from "../input-routing/strategies.js";
import { closeStrategies, presentations } from "../presentation/strategies.js";

function mergeCatalog(
  kind: string,
  current: Readonly<Record<string, unknown>>,
  added: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  for (const name of Object.keys(added ?? {})) {
    if (Object.hasOwn(current, name)) {
      throw new Error(`Duplicate ${kind} name: ${name}`);
    }
  }
  return Object.freeze({ ...current, ...added });
}

function buildDialogKit<
  C extends Context,
  Services,
  Dialogs extends DialogCatalog,
  Windows extends WindowCatalog,
>(
  registeredDialogs: Dialogs,
  registeredWindows: Windows,
): DialogKit<C, Services, Dialogs, Windows> {
  const viewModel = createViewModelFactory<C, Services>();
  const windowFactory = window as WindowFactory<C, Services>;
  const dialogFactory = createDialogFactory(windowFactory);
  const resources = Object.freeze([
    ...Object.values(registeredDialogs),
    ...Object.values(registeredWindows),
  ]) as DialogKit<C, Services, Dialogs, Windows>["resources"];
  // Validate ids and initial-window references while composing the kit, before a bot exists.
  new DefinitionRegistry<C>(resources);

  const kit: DialogKit<C, Services, Dialogs, Windows> = {
    viewModel,
    window: windowFactory,
    dialog: dialogFactory,
    scope: scopes,
    access,
    presentation: presentations,
    close: closeStrategies,
    inputRouting,
    dialogs: registeredDialogs,
    windows: registeredWindows,
    resources,

    extension(factory, options = {}) {
      return Object.freeze({
        name: options.name,
        contribution: freezeContribution(
          factory({
            viewModel,
            window: windowFactory,
            dialog: dialogFactory,
            scope: scopes,
            access,
          } as DialogExtensionContext<C, Services>),
        ),
      });
    },

    use<AddedDialogs extends DialogCatalog, AddedWindows extends WindowCatalog>(
      extension: DialogExtension<AddedDialogs, AddedWindows>,
    ) {
      const contribution = extension.contribution;
      return buildDialogKit<
        C,
        Services,
        Dialogs & AddedDialogs,
        Windows & AddedWindows
      >(
        mergeCatalog(
          "dialog",
          registeredDialogs,
          contribution.dialogs,
        ) as Dialogs & AddedDialogs,
        mergeCatalog(
          "window",
          registeredWindows,
          contribution.windows,
        ) as Windows & AddedWindows,
      );
    },

    extend(factory, options) {
      return kit.use(kit.extension(factory, options));
    },

    define(factory) {
      const catalog = factory({
        viewModel,
        window: windowFactory,
        dialog: dialogFactory,
        scope: scopes,
        access,
      });
      const addedDialogs: Record<
        string,
        DialogDefinition<any, any, any, any>
      > = {};
      const addedWindows: Record<
        string,
        WindowDefinition<any, any, any, any>
      > = {};
      for (const [name, resource] of Object.entries(catalog)) {
        if (resource.kind === "dialog") addedDialogs[name] = resource;
        else addedWindows[name] = resource;
      }
      return kit.use({
        contribution: freezeContribution({
          dialogs: addedDialogs,
          windows: addedWindows,
        }),
      } as never);
    },

    middleware(options: DialogKitMiddlewareOptions<C, Services>) {
      return dialogs<C, Services>({ ...options, list: resources });
    },
  };

  return Object.freeze(kit);
}

/** Creates an empty application-bound DialogKit with categorized built-in UI. */
export function createDialogKit<
  C extends Context = Context,
  Services = unknown,
>(): DialogKit<C, Services> {
  return buildDialogKit<C, Services, {}, {}>(
    Object.freeze({}),
    Object.freeze({}),
  );
}
