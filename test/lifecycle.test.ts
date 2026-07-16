import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  dialogs,
  MemoryStorageAdapter,
  textInput,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/index.js";
import type { TestContext } from "./helpers.js";

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
});
