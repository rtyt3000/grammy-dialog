import { Bot } from "grammy";
import {
  dialogs,
  closeStrategies,
  inputRouting,
  MemoryStorageAdapter,
  presentations,
  type DialogPlugin,
  type DialogStorageRecord,
} from "@ppsh/grammy-dialog";
import type { AppContext, AppServices } from "./app-types.js";
import { profileDialog } from "./dialogs/profile.js";
import { teamPollDialog } from "./dialogs/team-poll.js";
import { translationAdapter } from "./i18n.js";
import { services } from "./services.js";
import { counterCard } from "./windows/counter-card.js";
import { reportReadyWindow } from "./windows/report-ready.js";

export function createShowcaseBot(token: string) {
  const bot = new Bot<AppContext>(token);
  const plugin: DialogPlugin<AppContext, AppServices> = dialogs<AppContext, AppServices>({
    list: [profileDialog, teamPollDialog, counterCard, reportReadyWindow],
    storage: new MemoryStorageAdapter<DialogStorageRecord>(),
    services,
    i18n: {
      adapter: translationAdapter,
      locale: {
        resolve: ctx => ctx.from?.language_code === "pl" ? "pl" : "en",
      },
    },
    defaults: {
      presentation: presentations.auto(),
      close: closeStrategies.detach(),
      inputRouting: inputRouting.reply({ fallback: "latest" }),
    },
  });

  bot.use(plugin);
  bot.command("profile", ctx => ctx.dialog.start("profile"));
  bot.command("poll", ctx => ctx.dialog.start("team-poll"));
  bot.command("counter", ctx => ctx.ui.show("counter-card"));
  bot.command("report", ctx => ctx.ui.show("report-ready"));

  return { bot, dialogs: plugin };
}
