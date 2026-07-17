import { dialogDsl, type AppContext } from "../../app-types.js";
import { teamPollViewModel } from "./view-model.js";

/** Chat-scoped poll that permits interactions from every group member. */
export const teamPollDialog = dialogDsl.dialog(
  "team-poll",
  {
    viewModel: teamPollViewModel,
    windows: ({ window, ui }) => {
      const main = window("main", {
        text: ({ vm, t }) => t("poll.title", vm),
        keyboard: [[
          ui.button.intent("👍", teamPollViewModel.actions.yes),
          ui.button.intent("👎", teamPollViewModel.actions.no),
        ]],
      });
      return { main };
    },
    initial: "main",
    scope: dialogDsl.scope.chat<AppContext>(),
    access: dialogDsl.access.everyone<AppContext>(),
  },
);
