import { Bot } from "grammy";
import type { AppContext, AppServices } from "./app-types.js";
import { appDialogs } from "./app-dialogs.js";
import { translationAdapter } from "./i18n.js";
import { services } from "./services.js";

/** Creates a configured showcase bot without starting long polling. */
export function createShowcaseBot(token: string) {
  const bot = new Bot<AppContext>(token);

  bot.use(appDialogs.middleware({
    services,
    i18n: {
      adapter: translationAdapter,
      locale: {
        resolve: ctx => ctx.from?.language_code === "pl" ? "pl" : "en",
      },
    },
    defaults: {
      presentation: appDialogs.presentation.auto(),
      close: appDialogs.close.detach(),
      inputRouting: appDialogs.inputRouting.replyOrFocused(),
    },
  }));
  bot.command("profile", ctx => ctx.dialog.start(appDialogs.dialogs.profile));
  bot.command("poll", ctx => ctx.dialog.start(appDialogs.dialogs.teamPoll));
  bot.command("counter", ctx => ctx.ui.show(appDialogs.windows.counterCard));
  bot.command("report", ctx => ctx.ui.show(appDialogs.windows.reportReady));

  return { bot };
}
