import type { Context } from "grammy";
import { createDialogKit, type DialogFlavor } from "@ppsh/grammy-dialog";
import { counterExtension } from "./widgets/counter.js";

/** Application dependencies injected into showcase ViewModels. */
export interface AppServices {
  profiles: {
    displayName(userId: number): Promise<string>;
  };
}

/** grammY context augmented by the dialog middleware. */
export type AppContext = Context & DialogFlavor;

/** Application-bound DSL with third-party-style widgets installed once. */
export const dialogDsl = createDialogKit<AppContext, AppServices>()
  .use(counterExtension);
