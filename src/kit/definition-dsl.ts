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
export type DialogWindowFactory<C extends Context, State, View, Services> = (
  id: string,
  definition: Omit<
    WindowDefinition<C, State, View, Services>,
    "kind" | "id" | "viewModel"
  >,
) => WindowDefinition<C, State, View, Services>;

/** Values available while declaring windows owned by one dialog. */
export interface DialogWindowsContext<
  C extends Context,
  State,
  View,
  Services,
> {
  readonly window: DialogWindowFactory<C, State, View, Services>;
}

/** Context-bound dialog factory exposed by a DialogKit. */
export interface DialogFactory<C extends Context, Services> {
  /** Creates a dialog with one ViewModel shared by all of its windows. */
  <State, View>(
    id: string,
    definition: {
      readonly viewModel: ViewModelDefinition<State, View, C, Services>;
      readonly windows: (
        context: DialogWindowsContext<C, State, View, Services>,
      ) => Readonly<Record<string, WindowDefinition<C, State, View, Services>>>;
      readonly initial?: string;
      readonly scope?: ScopeStrategy<C>;
      readonly access?: AccessStrategy<C>;
    },
  ): DialogDefinition<C, State, View, Services>;
}

/** Application-bound factories used to define ViewModels and resources. */
export interface DialogDefinitionDsl<C extends Context, Services> {
  readonly viewModel: ViewModelFactory<C, Services>;
  readonly window: WindowFactory<C, Services>;
  readonly dialog: DialogFactory<C, Services>;
}

/** Creates the nested dialog factory used by kits and extension DSLs. */
export function createDialogFactory<C extends Context, Services>(
  windowFactory: WindowFactory<C, Services>,
): DialogFactory<C, Services> {
  return ((
    definitionOrId: string,
    builder?: {
      readonly viewModel: ViewModelDefinition<any, any, C, Services>;
      readonly windows: (
        context: DialogWindowsContext<C, any, any, Services>,
      ) => Readonly<Record<string, WindowDefinition<C, any, any, Services>>>;
      readonly initial?: string;
      readonly scope?: ScopeStrategy<C>;
      readonly access?: AccessStrategy<C>;
    },
  ) => {
    if (builder === undefined)
      throw new TypeError("A nested dialog requires a definition");
    const dialogViewModel = builder.viewModel;
    const localWindow = ((localId: string, definition: object) =>
      windowFactory(`${definitionOrId}.${localId}`, {
        ...definition,
        viewModel: dialogViewModel,
      } as never)) as DialogWindowFactory<C, any, any, Services>;
    return defineDialog({
      id: definitionOrId,
      viewModel: dialogViewModel,
      windows: builder.windows({ window: localWindow }),
      initial: builder.initial,
      scope: builder.scope,
      access: builder.access,
    });
  }) as DialogFactory<C, Services>;
}
