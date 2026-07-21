import {
  B,
  Br,
  Button,
  Code,
  Input,
  bind,
  createDialogKit,
  defineWidget,
  invalid,
  Keyboard,
  MemoryStorageAdapter,
  Row,
  Text,
  TextInput,
  valid,
  Window,
  type DialogStorageRecord,
  type InputValidation,
} from "@ppsh/grammy-dialog";

const validateText = (value: string): InputValidation<string> =>
  value === "" ? invalid("Required") : valid(value);

const Counter = defineWidget<{}, number>()({
  state: { initial: () => 0 },
  actions: {
    increment({ state }) {
      state.update((value) => value + 1);
    },
  },
  render: ({ state, actions }) => (
    <Row>
      <Button action={actions.increment()}>{state.value}</Button>
    </Row>
  ),
});

const builder = createDialogKit();
const nested = builder.dialog("nested", {
  viewModel: builder.viewModel({ initialState: {} }),
  windows: ({ window }) => ({
    main: window("main", {
      view: (
        <Window>
          <Text>
            Nested <B>view</B>
            <Br />
            <Code>ok</Code>
          </Text>
          <Keyboard>
            <Counter id="first" />
            <Counter id="second" />
          </Keyboard>
          <Input>
            <TextInput receive="rename" validate={validateText} />
          </Input>
        </Window>
      ),
      input: [bind.text("rename")],
    }),
  }),
});
const notice = builder.window("notice", {
  view: (
    <Window>
      <Text>Notice</Text>
    </Window>
  ),
});
const app = builder.define(() => ({ nested, notice }));

app.middleware({ storage: new MemoryStorageAdapter<DialogStorageRecord>() });
app.dialogs.nested;
app.windows.notice;
