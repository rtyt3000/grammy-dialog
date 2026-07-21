import type { Context } from "grammy";
import type {
  DialogDefinition,
  DialogResource,
  ViewModelFactory,
  WindowDefinition,
} from "../core.js";
import type { DialogPlugin } from "../integration/grammy-plugin.js";
import type { DialogRuntimeOptions } from "../runtime/contracts.js";
import type { DialogDefinitionDsl } from "./definition-dsl.js";
import type {
  AccessStrategies,
  ScopeStrategies,
} from "../policies/scope-access.js";
import type { InputRoutingStrategies } from "../input-routing/strategies.js";
import type {
  CloseStrategies,
  PresentationStrategies,
} from "../presentation/strategies.js";

/** Named collection of dialogs exposed through `kit.dialogs`. */
export type DialogCatalog = Readonly<
  Record<string, DialogDefinition<any, any, any, any>>
>;

/** Named collection of standalone windows exposed through `kit.windows`. */
export type WindowCatalog = Readonly<
  Record<string, WindowDefinition<any, any, any, any>>
>;

/** Named resources returned by `kit.define()`. */
export type ResourceCatalog = Readonly<Record<string, DialogResource<any>>>;

/** Dialog entries extracted from a mixed resource catalog. */
export type DialogsFrom<Resources extends ResourceCatalog> = {
  readonly [Name in keyof Resources as Resources[Name] extends DialogDefinition<
    any,
    any,
    any,
    any
  >
    ? Name
    : never]: Extract<Resources[Name], DialogDefinition<any, any, any, any>>;
};

/** Standalone-window entries extracted from a mixed resource catalog. */
export type WindowsFrom<Resources extends ResourceCatalog> = {
  readonly [Name in keyof Resources as Resources[Name] extends WindowDefinition<
    any,
    any,
    any,
    any
  >
    ? Name
    : never]: Extract<Resources[Name], WindowDefinition<any, any, any, any>>;
};

/** Values contributed by a DialogKit extension. */
export interface DialogExtensionContribution<
  Dialogs extends DialogCatalog = {},
  Windows extends WindowCatalog = {},
> {
  readonly dialogs?: Dialogs;
  readonly windows?: Windows;
}

/** Immutable extension that can contribute registered resources. */
export interface DialogExtension<
  Dialogs extends DialogCatalog = {},
  Windows extends WindowCatalog = {},
> {
  readonly name?: string;
  readonly contribution: DialogExtensionContribution<Dialogs, Windows>;
}

/** DSL passed while defining an application-bound extension. */
export interface DialogExtensionContext<C extends Context, Services>
  extends DialogDefinitionDsl<C, Services> {
  readonly scope: ScopeStrategies;
  readonly access: AccessStrategies;
}

/** Runtime options whose resource list is supplied by the kit. */
export type DialogKitMiddlewareOptions<C extends Context, Services> = Omit<
  DialogRuntimeOptions<C, Services>,
  "list"
>;

/**
 * Immutable, application-bound DSL containing factories, extensions, and all
 * resources registered before middleware creation.
 */
export interface DialogKit<
  C extends Context,
  Services,
  Dialogs extends DialogCatalog = {},
  Windows extends WindowCatalog = {},
> extends DialogDefinitionDsl<C, Services> {
  readonly scope: ScopeStrategies;
  readonly access: AccessStrategies;
  readonly presentation: PresentationStrategies;
  readonly close: CloseStrategies;
  readonly inputRouting: InputRoutingStrategies;
  readonly dialogs: Dialogs;
  readonly windows: Windows;
  readonly resources: ReadonlyArray<DialogResource<C>>;

  /** Defines a reusable extension against the types of this kit. */
  extension<
    AddedDialogs extends DialogCatalog = {},
    AddedWindows extends WindowCatalog = {},
  >(
    factory: (
      context: DialogExtensionContext<C, Services>,
    ) => DialogExtensionContribution<AddedDialogs, AddedWindows>,
    options?: { readonly name?: string },
  ): DialogExtension<AddedDialogs, AddedWindows>;

  /** Returns a new kit containing everything contributed by the extension. */
  use<AddedDialogs extends DialogCatalog, AddedWindows extends WindowCatalog>(
    extension: DialogExtension<AddedDialogs, AddedWindows>,
  ): DialogKit<C, Services, Dialogs & AddedDialogs, Windows & AddedWindows>;

  /** Defines and installs a local extension in one operation. */
  extend<
    AddedDialogs extends DialogCatalog = {},
    AddedWindows extends WindowCatalog = {},
  >(
    factory: (
      context: DialogExtensionContext<C, Services>,
    ) => DialogExtensionContribution<AddedDialogs, AddedWindows>,
    options?: { readonly name?: string },
  ): DialogKit<C, Services, Dialogs & AddedDialogs, Windows & AddedWindows>;

  /**
   * Adds ordinary application dialogs and standalone windows without treating
   * each resource as a plugin extension. The returned object is partitioned by kind.
   */
  define<Resources extends ResourceCatalog>(
    factory: (context: DialogExtensionContext<C, Services>) => Resources,
  ): DialogKit<
    C,
    Services,
    Dialogs & DialogsFrom<Resources>,
    Windows & WindowsFrom<Resources>
  >;

  /** Creates grammY middleware with the kit's dialogs and windows pre-registered. */
  middleware(
    options: DialogKitMiddlewareOptions<C, Services>,
  ): DialogPlugin<C, Services>;
}

/** Context-bound ViewModel factory exposed by a DialogKit. */
export type DialogKitViewModelFactory<
  C extends Context,
  Services,
> = ViewModelFactory<C, Services>;
