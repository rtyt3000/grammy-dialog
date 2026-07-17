import { access, scopes } from "@ppsh/grammy-dialog";
import { dialogDsl, type AppContext } from "../../app-types.js";
import { teamPollViewModel } from "./view-model.js";

/** Chat-scoped poll that permits interactions from every group member. */
export const teamPollDialog = dialogDsl.dialog(
  "team-poll",
  ({ window, widgets }) => {
    const main = window("main", {
      viewModel: teamPollViewModel,
      text: ({ vm, t }) => t("poll.title", vm),
      keyboard: [[
        widgets.intent("👍", "yes"),
        widgets.intent("👎", "no"),
      ]],
    });
    return {
      windows: { main },
      scope: scopes.chat<AppContext>(),
      access: access.everyone<AppContext>(),
    };
  },
);
