import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  dialogs,
  inputRouting,
  textInput,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/index.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

function inputWindow(id: string, closeAfterInput = false) {
  const vm = viewModel({
    initialState: { value: "" },
    load: ({ state }) => state,
    intents: {
      receive({ state, value, navigation }) {
        state.update(current => ({ ...current, value: String(value) }));
        if (closeAfterInput) navigation.close();
      },
    },
  });
  return window(id, {
    viewModel: vm,
    text: ({ vm }) => `${id}: ${vm.value}`,
    input: [textInput(`${id}-input`, { onReceive: "receive" })],
  });
}

function createBot(
  storage: JsonStorageAdapter<DialogStorageRecord>,
  strategy = inputRouting.latest<TestContext>(),
  closeSecond = false,
) {
  const first = inputWindow("first");
  const second = inputWindow("second", closeSecond);
  const bot = new Bot<TestContext>("test-token");
  bot.use(dialogs<TestContext>({
    list: [first, second],
    storage,
    defaults: { inputRouting: strategy },
  }));
  bot.command("first", ctx => ctx.ui.show("first"));
  bot.command("second", ctx => ctx.ui.show("second"));
  bot.command("both", async ctx => {
    await ctx.ui.show("first");
    await ctx.ui.show("second");
  });
  return bot;
}

function instanceState(storage: JsonStorageAdapter<DialogStorageRecord>, definitionId: string) {
  const record = [...storage.readAllValues()].find(entry =>
    entry.type === "instance" && entry.value.definitionId === definitionId
  );
  return record?.type === "instance" ? record.value.state : undefined;
}

describe("input routing strategies", () => {
  test("serializes concurrent focus updates for the same actor", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const first = window("concurrent-first", { text: "First" });
    const second = window("concurrent-second", { text: "Second" });
    const plugin = dialogs<TestContext>({ list: [first, second], storage });
    const bot = new Bot<TestContext>("test-token");
    bot.use(plugin);
    bot.command("concurrent", ctx => Promise.all([
      ctx.ui.show("concurrent-first"),
      ctx.ui.show("concurrent-second"),
    ]).then(() => undefined));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("concurrent");

    const focus = storage.read(`gd:focus:${user.id}:root:${user.id}`);
    expect(focus?.type === "focus" && focus.version === 2
      ? focus.value.instanceIds
      : []).toHaveLength(2);
  });

  test("oldest can route input to an earlier active instance", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createBot(storage, inputRouting.oldest<TestContext>()));
    const user = chats.newUser();
    await user.sendCommand("both");

    await user.sendText("for first");

    expect(instanceState(storage, "first")).toEqual({ value: "for first" });
    expect(instanceState(storage, "second")).toEqual({ value: "" });
  });

  test("closing the latest instance reveals the previous focus", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createBot(
      storage,
      inputRouting.latest<TestContext>(),
      true,
    ));
    const user = chats.newUser();
    await user.sendCommand("both");

    await user.sendText("close second");
    await user.sendText("then first");

    expect(instanceState(storage, "first")).toEqual({ value: "then first" });
    expect(instanceState(storage, "second")).toEqual({ value: "close second" });
  });
});
