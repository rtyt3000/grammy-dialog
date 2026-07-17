import { photo, t } from "@ppsh/grammy-dialog";
import { dialogDsl } from "../app-types.js";

/** Dialogless media window suitable for foreground or background delivery. */
export const reportReadyWindow = dialogDsl.window("report-ready", {
  text: async ({ t }) => `<b>${await t("notification.title")}</b>`,
  parseMode: "HTML",
  media: photo("https://picsum.photos/seed/grammy-dialog/800/400"),
});
