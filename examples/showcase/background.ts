import type { Api } from "grammy";
import type { DialogPlugin } from "@ppsh/grammy-dialog";
import type { AppContext, AppServices } from "./app-types.js";
import { appDialogs } from "./app-dialogs.js";

/** Shows a registered standalone window without an incoming grammY update. */
export async function sendReportFromBackground(
  plugin: DialogPlugin<AppContext, AppServices>,
  api: Api,
  chatId: number,
  userId: number,
): Promise<void> {
  await plugin.runtime.show(appDialogs.windows.reportReady, {
    api,
    chatId,
    actorId: userId,
    locale: "en",
  });
}
