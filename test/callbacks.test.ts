import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  button,
  defineDialog,
  dialogs,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/index.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

function counterDialog() {
  const counterVm = viewModel({
    initialState: { count: 0 },
    load: ({ state }) => state,
    intents: {
      increment({ state }) {
        state.update(value => ({ count: value.count + 1 }));
      },
    },
  });
  const main = window("counter.main", {
    viewModel: counterVm,
    text: ({ vm }) => `Count: ${vm.count}`,
    keyboard: [[button("Increment", "increment")]],
  });
  return defineDialog({ id: "counter", initial: "main", windows: { main } });
}

function createCounterBot(storage: JsonStorageAdapter<DialogStorageRecord>) {
  const bot = new Bot<TestContext>("test-token");
  bot.use(dialogs<TestContext>({ list: [counterDialog()], storage }));
  bot.command("counter", ctx => ctx.dialog.start("counter"));
  return bot;
}

describe("callbacks", () => {
  test("rerenders after an opaque callback intent with serialized storage", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createCounterBot(storage));
    const user = chats.newUser();
    await user.sendCommand("counter");

    const reply = user.replies.lastOrThrow();
    expect(reply.text).toBe("Count: 0");
    expect(reply.buttons[0]?.callbackData).toMatch(/^gd:[a-f0-9]{32}$/);
    await reply.clickButton("Increment");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("Count: 1");
  });

  test("keeps previous state and callback when Telegram rerender fails", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createCounterBot(storage));
    const user = chats.newUser();
    await user.sendCommand("counter");
    const reply = user.replies.lastOrThrow();
    const callbackData = reply.buttons[0]!.callbackData!;
    chats.outgoing.failNext("editMessageText", {
      code: 500,
      description: "render failed",
    });

    await expect(reply.clickButton("Increment")).rejects.toThrow("render failed");

    const instance = [...storage.readAllValues()]
      .find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.state : undefined)
      .toEqual({ count: 0 });
    expect(storage.read(`gd:callback:${callbackData.slice(3)}`)?.type).toBe("callback");
  });

  test("serializes concurrent clicks on the same callback", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createCounterBot(storage));
    const user = chats.newUser();
    await user.sendCommand("counter");
    const reply = user.replies.lastOrThrow();

    await Promise.all([
      reply.clickButton("Increment"),
      reply.clickButton("Increment"),
    ]);

    expect(chats.editsFor(user).length).toBe(1);
    const instance = [...storage.readAllValues()]
      .find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.state : undefined)
      .toEqual({ count: 1 });
  });

  test("resolves an existing callback after runtime restart", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const firstBot = createCounterBot(storage);
    const first = await prepareBot(firstBot);
    const firstUser = first.chats.newUser({ id: 123_456, first_name: "Restart user" });
    await firstUser.sendCommand("counter");
    const reply = firstUser.replies.lastOrThrow();

    const secondBot = createCounterBot(storage);
    const second = await prepareBot(secondBot);
    second.chats.newUser({ id: firstUser.id, first_name: firstUser.first_name });
    await secondBot.handleUpdate({
      update_id: 700_001,
      callback_query: {
        id: "after-restart",
        from: {
          id: firstUser.id,
          is_bot: false,
          first_name: firstUser.first_name,
        },
        chat_instance: "restart",
        data: reply.buttons[0]!.callbackData!,
        message: {
          message_id: reply.messageId,
          date: 0,
          chat: {
            id: firstUser.id,
            type: "private",
            first_name: firstUser.first_name,
          },
        },
      },
    });

    const edit = second.chats.outgoing.requests.find(request => request.method === "editMessageText");
    expect((edit?.payload as { text?: string } | undefined)?.text).toBe("Count: 1");
  });
});
