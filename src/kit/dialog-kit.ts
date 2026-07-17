import type { Context } from "grammy";
import {
  createViewModelFactory,
  window,
  type DialogDefinition,
  type WindowDefinition,
} from "../core.js";
import { dialogs } from "../integration/grammy-plugin.js";
import { DefinitionRegistry } from "../runtime/definition-registry.js";
import { builtInWidgets, type BuiltInWidgetCatalog } from "./built-in-widgets.js";
import type {
  DialogCatalog,
  DialogExtension,
  DialogExtensionContext,
  DialogKit,
  DialogKitMiddlewareOptions,
  WidgetCatalog,
  WindowCatalog,
} from "./contracts.js";
import {
  widgetDefinitionDsl,
  createDialogFactory,
  type WindowFactory,
} from "./definition-dsl.js";
import { freezeContribution } from "./extension.js";

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
  Widgets extends WidgetCatalog,
  Dialogs extends DialogCatalog,
  Windows extends WindowCatalog,
>(
  widgets: Widgets,
  registeredDialogs: Dialogs,
  registeredWindows: Windows,
): DialogKit<C, Services, Widgets, Dialogs, Windows> {
  const viewModel = createViewModelFactory<C, Services>();
  const windowFactory = window as WindowFactory<C, Services>;
  const dialogFactory = createDialogFactory(viewModel, windowFactory, widgets);
  const resources = Object.freeze([
    ...Object.values(registeredDialogs),
    ...Object.values(registeredWindows),
  ]) as DialogKit<C, Services, Widgets, Dialogs, Windows>["resources"];
  // Validate ids and initial-window references while composing the kit, before a bot exists.
  new DefinitionRegistry<C>(resources);

  const kit: DialogKit<C, Services, Widgets, Dialogs, Windows> = {
    viewModel,
    window: windowFactory,
    dialog: dialogFactory,
    widgets,
    dialogs: registeredDialogs,
    windows: registeredWindows,
    define: widgetDefinitionDsl,
    resources,

    extension(factory, options = {}) {
      return Object.freeze({
        name: options.name,
        contribution: freezeContribution(factory({
          viewModel,
          window: windowFactory,
          dialog: dialogFactory,
          widgets,
          define: widgetDefinitionDsl,
        } as DialogExtensionContext<C, Services, Widgets>)),
      });
    },

    use<
      AddedWidgets extends WidgetCatalog,
      AddedDialogs extends DialogCatalog,
      AddedWindows extends WindowCatalog,
    >(extension: DialogExtension<AddedWidgets, AddedDialogs, AddedWindows>) {
      const contribution = extension.contribution;
      return buildDialogKit<C, Services, Widgets & AddedWidgets, Dialogs & AddedDialogs, Windows & AddedWindows>(
        mergeCatalog("widget", widgets, contribution.widgets) as Widgets & AddedWidgets,
        mergeCatalog("dialog", registeredDialogs, contribution.dialogs) as Dialogs & AddedDialogs,
        mergeCatalog("window", registeredWindows, contribution.windows) as Windows & AddedWindows,
      );
    },

    extend(factory, options) {
      return kit.use(kit.extension(factory, options));
    },

    compose(factory) {
      const catalog = factory({
        viewModel,
        window: windowFactory,
        dialog: dialogFactory,
        widgets,
        define: widgetDefinitionDsl,
      });
      const addedDialogs: Record<string, DialogDefinition<any>> = {};
      const addedWindows: Record<string, WindowDefinition<any, any, any, any>> = {};
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

/** Creates an empty application-bound DialogKit with all built-in widgets. */
export function createDialogKit<
  C extends Context = Context,
  Services = unknown,
>(): DialogKit<C, Services, BuiltInWidgetCatalog> {
  return buildDialogKit<C, Services, BuiltInWidgetCatalog, {}, {}>(
    builtInWidgets,
    Object.freeze({}),
    Object.freeze({}),
  );
}
