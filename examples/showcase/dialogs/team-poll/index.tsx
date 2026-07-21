import {
  Button,
  Keyboard,
  Row,
  Text,
  Window,
  intent,
} from "@ppsh/grammy-dialog";
import { dialogDsl, type AppContext } from "../../app-types.js";
import { teamPollViewModel } from "./view-model.js";

/** Chat-scoped poll that permits interactions from every group member. */
export const teamPollDialog = dialogDsl.dialog("team-poll", {
  viewModel: teamPollViewModel,
  windows: ({ window }) => {
    const main = window("main", {
      view: async ({ vm, t }) => (
        <Window>
          <Text>{await t("poll.title", vm)}</Text>
          <Keyboard>
            <Row>
              <Button action={intent(teamPollViewModel.actions.yes)}>👍</Button>
              <Button action={intent(teamPollViewModel.actions.no)}>👎</Button>
            </Row>
          </Keyboard>
        </Window>
      ),
    });
    return { main };
  },
  initial: "main",
  scope: dialogDsl.scope.chat<AppContext>(),
  access: dialogDsl.access.everyone<AppContext>(),
});
