import { describe, expect, test } from "bun:test";
import { Bot, type StorageAdapter } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  button,
  defineDialog,
  dialogs,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/internal.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

class BlockingCallbackStorage implements StorageAdapter<DialogStorageRecord> {
  public readonly identities: JsonStorageAdapter<DialogStorageRecord>["identities"];
  private blocked?: {
    readonly seen: () => void;
    readonly released: Promise<void>;
  };
  private release?: () => void;

  public constructor(
    private readonly delegate: JsonStorageAdapter<DialogStorageRecord>,
  ) {
    this.identities = delegate.identities;
  }

  public read(
    key: string,
  ): DialogStorageRecord | undefined | Promise<DialogStorageRecord | undefined> {
    const value = this.delegate.read(key);
    if (!key.startsWith("gd:callback:") || this.blocked === undefined) return value;
    const blocked = this.blocked;
    this.blocked = undefined;
    blocked.seen();
    return blocked.released.then(() => value);
  }

  public write(key: string, value: DialogStorageRecord): void {
    this.delegate.write(key, value);
  }

  public delete(key: string): void {
    this.delegate.delete(key);
  }

  public blockNextCallbackRead(): Promise<void> {
    let seen!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>(resolve => {
      seen = resolve;
    });
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    this.blocked = { seen, released };
    this.release = release;
    return waiting;
  }

  public releaseCallbackRead(): void {
    this.release?.();
    this.release = undefined;
  }
}

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
  return defineDialog({
    id: "counter",
    initial: "main",
    viewModel: counterVm,
    windows: { main },
  });
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

  test("invalidates a callback read before keyed reuse rerenders", async () => {
    const backing = new JsonStorageAdapter<DialogStorageRecord>();
    const storage = new BlockingCallbackStorage(backing);
    const dialog = counterDialog();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [dialog], storage }));
    bot.command("counter", ctx => ctx.dialog.start(dialog, {
      key: "primary",
      mode: "create",
    }));
    bot.command("reuse", ctx => ctx.dialog.start(dialog, {
      key: "primary",
      mode: "reuse",
    }));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("counter");
    const reply = user.replies.lastOrThrow();
    const callbackRead = storage.blockNextCallbackRead();
    const staleClick = reply.clickButton("Increment");
    await callbackRead;

    await user.sendCommand("reuse");
    storage.releaseCallbackRead();
    await staleClick;

    const instance = [...backing.readAllValues()]
      .find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.revision : undefined).toBe(1);
    expect(instance?.type === "instance" ? instance.value.state : undefined)
      .toEqual({ count: 0 });
    expect(chats.editsFor(user)).toHaveLength(1);
  });
});
