import { B, Photo, Text, Window } from "@ppsh/grammy-dialog";
import { dialogDsl } from "../app-types.js";

/** Dialogless media window suitable for foreground or background delivery. */
export const reportReadyWindow = dialogDsl.window("report-ready", {
  view: async ({ t }) => (
    <Window>
      <Text>
        <B>{await t("notification.title")}</B>
      </Text>
      <Photo source="https://picsum.photos/seed/grammy-dialog/800/400" />
    </Window>
  ),
});
