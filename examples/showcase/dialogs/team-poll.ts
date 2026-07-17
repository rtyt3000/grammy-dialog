import {
  access,
  button,
  defineDialog,
  scopes,
  viewModel,
  window,
} from "@ppsh/grammy-dialog";
import type { AppContext } from "../app-types.js";

const pollVm = viewModel({
  initialState: { yes: 0, no: 0 },
  intents: {
    yes({ state }) {
      state.update(current => ({ ...current, yes: current.yes + 1 }));
    },
    no({ state }) {
      state.update(current => ({ ...current, no: current.no + 1 }));
    },
  },
});

const main = window("team-poll.main", {
  viewModel: pollVm,
  text: ({ vm, t }) => t("poll.title", vm),
  keyboard: [[button("👍", "yes"), button("👎", "no")]],
});

export const teamPollDialog = defineDialog({
  id: "team-poll",
  windows: { main },
  scope: scopes.chat<AppContext>(),
  access: access.everyone<AppContext>(),
});
