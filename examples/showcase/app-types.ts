import type { Context } from "grammy";
import type { DialogFlavor } from "@ppsh/grammy-dialog";

export interface AppServices {
  profiles: {
    displayName(userId: number): Promise<string>;
  };
}

export type AppContext = Context & DialogFlavor;
