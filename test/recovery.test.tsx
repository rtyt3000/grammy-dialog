import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  Button,
  dialogs,
  intent,
  Keyboard,
  Photo,
  Row,
  Text,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/internal.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

function createWindow() {
  const vm = viewModel({
    initialState: { count: 0 },
    load: ({ state }) => state,
    intents: {
      increment({ state }) {
        state.update((current) => ({ count: current.count + 1 }));
      },
    },
  });
  return window("recovery", {
    viewModel: vm,
    view: ({ vm }) => (
      <>
        <Text>Count: {vm.count}</Text>
        <Keyboard>
          <Row>
            <Button action={intent<undefined>("increment")}>Increment</Button>
          </Row>
        </Keyboard>
      </>
    ),
  });
}

function createBot(storage: JsonStorageAdapter<DialogStorageRecord>) {
  const bot = new Bot<TestContext>("test-token");
  bot.use(dialogs<TestContext>({ list: [createWindow()], storage }));
  bot.command("recovery", (ctx) => ctx.ui.show("recovery"));
  return bot;
}

describe("side-effect recovery", () => {
  test("deletes an orphan surface when initial instance persistence fails", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createBot(storage));
    const user = chats.newUser();
    storage.failNextWrite("gd:instance:");

    await expect(user.sendCommand("recovery")).rejects.toThrow(
      "storage write failed",
    );

    expect(chats.outgoing.getMethods()).toContain("sendMessage");
    expect(chats.outgoing.getMethods()).toContain("deleteMessage");
    expect(
      [...storage.readAllKeys()].some((key) => key.startsWith("gd:instance:")),
    ).toBe(false);
    expect(
      [...storage.readAllKeys()].some((key) => key.startsWith("gd:callback:")),
    ).toBe(false);
    expect(
      [...storage.readAllKeys()].some((key) => key.startsWith("gd:focus:")),
    ).toBe(false);
  });

  test("rolls an edited surface back when instance persistence fails", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createBot(storage));
    const user = chats.newUser();
    await user.sendCommand("recovery");
    const reply = user.replies.lastOrThrow();
    chats.outgoing.clear();
    storage.failNextWrite("gd:instance:");
    storage.failNextDelete("gd:callback:");

    await expect(reply.clickButton("Increment")).rejects.toThrow(
      "storage write failed",
    );

    const editTexts = chats.outgoing.requests
      .filter((request) => request.method === "editMessageText")
      .map((request) => (request.payload as { text?: string }).text);
    expect(editTexts).toEqual(["Count: 1", "Count: 0"]);
    const instance = [...storage.readAllValues()].find(
      (record) => record.type === "instance",
    );
    expect(
      instance?.type === "instance" ? instance.value.state : undefined,
    ).toEqual({ count: 0 });
    expect(
      instance?.type === "instance" ? instance.value.callbackTokens.length : 0,
    ).toBe(1);
    const rollbackToken =
      instance?.type === "instance"
        ? instance.value.callbackTokens[0]
        : undefined;
    expect(
      rollbackToken === undefined
        ? undefined
        : storage.read(`gd:callback:${rollbackToken}`)?.type,
    ).toBe("callback");
  });

  test("keeps visible rollback callbacks when rollback persistence also fails", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(createBot(storage));
    const user = chats.newUser();
    await user.sendCommand("recovery");
    const reply = user.replies.lastOrThrow();
    chats.outgoing.clear();
    storage.failNextWrites("gd:instance:", 2);

    await expect(reply.clickButton("Increment")).rejects.toThrow(
      "Failed to roll back Telegram surface",
    );

    const rollbackEdit = chats.outgoing.requests
      .filter((request) => request.method === "editMessageText")
      .at(-1);
    const rollbackCallbackData = (
      rollbackEdit?.payload as
        | {
            reply_markup?: {
              inline_keyboard?: Array<Array<{ callback_data?: string }>>;
            };
          }
        | undefined
    )?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data;
    const rollbackToken = rollbackCallbackData?.startsWith("gd:")
      ? rollbackCallbackData.slice("gd:".length)
      : undefined;
    expect(rollbackToken).toBeDefined();
    expect(
      rollbackToken === undefined
        ? undefined
        : storage.read(`gd:callback:${rollbackToken}`)?.type,
    ).toBe("callback");
  });

  test("keeps the old surface when replacement persistence fails", async () => {
    const vm = viewModel({
      initialState: { withPhoto: false },
      load: ({ state }) => state,
      intents: {
        attach({ state }) {
          state.update((current) => ({ ...current, withPhoto: true }));
        },
      },
    });
    const replaceWindow = window("replacement-recovery", {
      viewModel: vm,
      view: ({ vm }) => (
        <>
          <Text>{vm.withPhoto ? "Photo" : "Text"}</Text>
          {vm.withPhoto ? <Photo source="replacement-photo" /> : null}
          <Keyboard>
            <Row>
              <Button action={intent<undefined>("attach")}>Attach</Button>
            </Row>
          </Keyboard>
        </>
      ),
    });
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [replaceWindow], storage }));
    bot.command("replace", (ctx) => ctx.ui.show("replacement-recovery"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("replace");
    const oldSurface = user.replies.lastOrThrow();
    chats.outgoing.clear();
    storage.failNextWrite("gd:instance:");

    await expect(oldSurface.clickButton("Attach")).rejects.toThrow(
      "storage write failed",
    );

    const sent = chats.outgoing.requests.find(
      (request) => request.method === "sendPhoto",
    );
    const deleted = chats.outgoing.requests.find(
      (request) => request.method === "deleteMessage",
    );
    expect(sent).toBeDefined();
    expect(
      (deleted?.payload as { message_id?: number } | undefined)?.message_id,
    ).not.toBe(oldSurface.messageId);
    const instance = [...storage.readAllValues()].find(
      (record) => record.type === "instance",
    );
    expect(
      instance?.type === "instance"
        ? instance.value.surface?.messageId
        : undefined,
    ).toBe(oldSurface.messageId);
    expect(
      instance?.type === "instance" ? instance.value.state : undefined,
    ).toEqual({ withPhoto: false });
    const callbacks = [...storage.readAllKeys()].filter((key) =>
      key.startsWith("gd:callback:"),
    );
    expect(callbacks).toHaveLength(1);
  });

  test("keeps a committed replacement when old callback cleanup fails", async () => {
    const vm = viewModel({
      initialState: { withPhoto: false },
      load: ({ state }) => state,
      intents: {
        attach({ state }) {
          state.update((current) => ({ ...current, withPhoto: true }));
        },
      },
    });
    const replaceWindow = window("replacement-commit", {
      viewModel: vm,
      view: ({ vm }) => (
        <>
          <Text>{vm.withPhoto ? "Photo" : "Text"}</Text>
          {vm.withPhoto ? <Photo source="replacement-photo" /> : null}
          <Keyboard>
            <Row>
              <Button action={intent<undefined>("attach")}>Attach</Button>
            </Row>
          </Keyboard>
        </>
      ),
    });
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [replaceWindow], storage }));
    bot.command("replace", (ctx) => ctx.ui.show("replacement-commit"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("replace");
    const oldSurface = user.replies.lastOrThrow();
    chats.outgoing.clear();
    storage.failNextDelete("gd:callback:");

    await expect(oldSurface.clickButton("Attach")).resolves.toBeUndefined();

    const instance = [...storage.readAllValues()].find(
      (record) => record.type === "instance",
    );
    expect(
      instance?.type === "instance"
        ? instance.value.surface?.messageId
        : undefined,
    ).not.toBe(oldSurface.messageId);
    expect(
      instance?.type === "instance" ? instance.value.state : undefined,
    ).toEqual({ withPhoto: true });
    const committedToken =
      instance?.type === "instance"
        ? instance.value.callbackTokens[0]
        : undefined;
    expect(
      committedToken === undefined
        ? undefined
        : storage.read(`gd:callback:${committedToken}`)?.type,
    ).toBe("callback");
    expect(
      chats.outgoing.requests.filter(
        (request) => request.method === "deleteMessage",
      ),
    ).toHaveLength(1);
  });
});
