import { dialogDsl } from "./app-types.js";
import { profileDialog } from "./dialogs/profile/index.js";
import { teamPollDialog } from "./dialogs/team-poll/index.js";
import { counterCard } from "./windows/counter-card.js";
import { reportReadyWindow } from "./windows/report-ready.js";

/** Complete immutable catalog used by the showcase middleware and commands. */
export const appDialogs = dialogDsl.compose(() => ({
  profile: profileDialog,
  teamPoll: teamPollDialog,
  counterCard,
  reportReady: reportReadyWindow,
}));
