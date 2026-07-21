import type { Context } from "grammy";
import {
  B,
  Button,
  Input,
  Keyboard,
  Row,
  Text,
  TextInput,
  Window,
  createDialogKit,
  invalid,
  intent,
  valid,
  type DialogFlavor,
  type InputValidation,
} from "../mod.ts";

type BotContext = Context & DialogFlavor;

const kit = createDialogKit<BotContext>();
const counterVm = kit.viewModel({
  initialState: { count: 0 },
  intents: {
    increment({ state }) {
      state.update((current) => ({ count: current.count + 1 }));
    },
  },
});

const validateName = (value: string): InputValidation<string> =>
  value.length >= 2 ? valid(value.trim()) : invalid("Too short");

kit.window("tsx", {
  viewModel: counterVm,
  view: ({ vm }) => (
    <Window>
      <Text>
        Count: <B>{vm.count}</B>
      </Text>
      <Keyboard>
        <Row>
          <Button action={intent(counterVm.actions.increment)}>+1</Button>
        </Row>
      </Keyboard>
    </Window>
  ),
});

kit.window("validated-input", {
  viewModel: counterVm,
  view: (
    <Window>
      <Input>
        <TextInput receive="rename" validate={validateName} />
      </Input>
    </Window>
  ),
});

// @ts-expect-error Callback buttons require a serializable ButtonAction.
const invalidButton = <Button action={() => undefined}>Invalid</Button>;
void invalidButton;
