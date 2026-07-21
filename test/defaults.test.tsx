import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  Button,
  defineWidget,
  defineDialog,
  dialogs,
  intent,
  Keyboard,
  Row,
  textInput,
  Text,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/internal.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

describe("DSL defaults", () => {
  test("uses state as the view and the first dialog window as initial", async () => {
    const vm = viewModel({
      initialState: { count: 0 },
      intents: {
        increment({ state }) {
          state.update((current) => ({ count: current.count + 1 }));
        },
      },
    });
    const main = window("defaults.main", {
      viewModel: vm,
      view: ({ vm: view }) => (
        <>
          <Text>Count: {view.count}</Text>
          <Keyboard>
            <Row>
              <Button action={intent(vm.actions.increment)}>Increment</Button>
            </Row>
          </Keyboard>
        </>
      ),
    });
    const dialog = defineDialog({
      id: "defaults",
      viewModel: vm,
      windows: { main },
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [dialog] }));
    bot.command("defaults", (ctx) => ctx.dialog.start("defaults"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("defaults");
    const reply = user.replies.lastOrThrow();
    expect(reply.text).toBe("Count: 0");
    await reply.clickButton("Increment");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("Count: 1");
  });

  test("uses input id as the receive intent", async () => {
    const vm = viewModel({
      initialState: { value: "" },
      intents: {
        receive({ state, value }) {
          state.update((current) => ({ ...current, value: String(value) }));
        },
      },
    });
    const inputWindow = window("default-input", {
      viewModel: vm,
      view: ({ vm }) => <Text>{vm.value}</Text>,
      input: [textInput("receive")],
    });
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [inputWindow], storage }));
    bot.command("input", (ctx) => ctx.ui.show("default-input"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("input");
    await user.sendText("received");

    const instance = [...storage.readAllValues()].find(
      (record) => record.type === "instance",
    );
    expect(
      instance?.type === "instance" ? instance.value.state : undefined,
    ).toEqual({ value: "received" });
  });

  test("creates an empty ViewModel by default", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const vm = viewModel();
    const staticWindow = window("empty-vm", {
      viewModel: vm,
      view: <Text>Empty</Text>,
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [staticWindow], storage }));
    bot.command("empty", (ctx) => ctx.ui.show("empty-vm"));
    const { chats } = await prepareBot(bot);
    await chats.newUser().sendCommand("empty");

    const instance = [...storage.readAllValues()].find(
      (record) => record.type === "instance",
    );
    expect(
      instance?.type === "instance" ? instance.value.state : undefined,
    ).toEqual({});
  });

  test("defaults widget state schema version to one", () => {
    const Counter = defineWidget<{}, number>()({
      state: { initial: () => 0 },
      actions: {},
      render: () => [],
    });

    expect(
      (
        Counter({ id: "counter" }).props.instance as {
          definition: { state: { version: number } };
        }
      ).definition.state.version,
    ).toBe(1);
  });
});
