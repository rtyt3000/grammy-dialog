import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  button,
  close,
  closeStrategies,
  dialogs,
  MemoryStorageAdapter,
  textInput,
  viewModel,
  window,
  type CloseStrategy,
  type DialogStorageRecord,
} from "../src/index.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

describe("instance lifecycle", () => {
  test("closes an input-only window without editing absent reply markup", async () => {
    const closeVm = viewModel({
      initialState: {},
      load: ({ state }) => state,
      intents: {
        finish({ navigation }) {
          navigation.close();
        },
      },
    });
    const inputOnly = window("input-only", {
      viewModel: closeVm,
      text: "Send anything to close",
      input: [textInput("finish", { onReceive: "finish" })],
    });
    const storage = new MemoryStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [inputOnly], storage }));
    bot.command("close", ctx => ctx.ui.show("input-only"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("close");
    chats.outgoing.clear();
    await user.sendText("done");

    expect(chats.outgoing.getMethods()).not.toContain("editMessageReplyMarkup");
    const instance = [...storage.readAllValues()].find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.status : undefined).toBe("closed");
    expect([...storage.readAllKeys()].some(key => key.startsWith("gd:focus:"))).toBe(false);
  });

  async function closeWith(strategy: CloseStrategy) {
    const vm = viewModel({ initialState: {}, load: ({ state }) => state, intents: {} });
    const closeWindow = window("close-window", {
      viewModel: vm,
      text: "Close me",
      keyboard: [[button("Close", close())]],
    });
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({
      list: [closeWindow],
      storage,
      defaults: { close: strategy },
    }));
    bot.command("close", ctx => ctx.ui.show("close-window"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("close");
    const reply = user.replies.lastOrThrow();
    chats.outgoing.clear();
    await reply.clickButton("Close");
    const instance = [...storage.readAllValues()].find(record => record.type === "instance");
    return { chats, instance };
  }

  test("delete close strategy removes the surface", async () => {
    const { chats, instance } = await closeWith(closeStrategies.delete());
    expect(chats.outgoing.getMethods()).toContain("deleteMessage");
    expect(instance?.type === "instance" ? instance.value.surface : null).toBeUndefined();
  });

  test("keep close strategy leaves the surface untouched", async () => {
    const { chats, instance } = await closeWith(closeStrategies.keep());
    expect(chats.outgoing.getMethods()).not.toContain("deleteMessage");
    expect(chats.outgoing.getMethods()).not.toContain("editMessageReplyMarkup");
    expect(instance?.type === "instance" ? instance.value.callbackTokens : null).toEqual([]);
    expect(instance?.type === "instance" ? instance.value.surface?.hasKeyboard : null).toBe(true);
  });
});
