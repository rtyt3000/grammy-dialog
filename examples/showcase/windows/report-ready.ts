import { photo, t, window } from "@ppsh/grammy-dialog";

/** Dialogless media window suitable for foreground or background delivery. */
export const reportReadyWindow = window("report-ready", {
  text: async ({ t }) => `<b>${await t("notification.title")}</b>`,
  parseMode: "HTML",
  media: photo("https://picsum.photos/seed/grammy-dialog/800/400"),
});
