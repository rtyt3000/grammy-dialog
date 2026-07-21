import { Keyboard, Text, Window } from "@ppsh/grammy-dialog";
import { dialogDsl } from "../app-types.js";
import { Counter } from "../widgets/counter.js";

/** Dialogless window demonstrating a reusable stateful keyboard widget. */
export const counterCard = dialogDsl.window("counter-card", {
  view: (
    <Window>
      <Text>A reusable stateful widget:</Text>
      <Keyboard>
        <Counter id="amount" />
      </Keyboard>
    </Window>
  ),
});
