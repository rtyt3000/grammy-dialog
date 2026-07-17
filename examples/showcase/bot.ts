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

/** Creates a configured showcase bot without starting long polling. */
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
  bot.command("profile", ctx => ctx.dialog.start(profileDialog));
  bot.command("poll", ctx => ctx.dialog.start(teamPollDialog));
  bot.command("counter", ctx => ctx.ui.show(counterCard));
  bot.command("report", ctx => ctx.ui.show(reportReadyWindow));

  return { bot, dialogs: plugin };
}
