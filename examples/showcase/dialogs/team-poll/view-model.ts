import { dialogDsl } from "../../app-types.js";

/** Shared vote counts persisted by the team-poll dialog. */
export const teamPollViewModel = dialogDsl.viewModel({
  initialState: { yes: 0, no: 0 },
  intents: {
    yes({ state }) {
      state.update((current) => ({ ...current, yes: current.yes + 1 }));
    },
    no({ state }) {
      state.update((current) => ({ ...current, no: current.no + 1 }));
    },
  },
});
