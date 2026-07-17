import type { Context } from "grammy";
import type { DialogFlavor } from "@ppsh/grammy-dialog";

/** Application dependencies injected into showcase ViewModels. */
export interface AppServices {
  profiles: {
    displayName(userId: number): Promise<string>;
  };
}

/** grammY context augmented by the dialog middleware. */
export type AppContext = Context & DialogFlavor;
