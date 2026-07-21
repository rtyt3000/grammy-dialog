import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  Button,
  dialogs,
  intent,
  Keyboard,
  presentations,
  Row,
  Text,
  viewModel,
  window,
  type DialogStorageRecord,
  type PresentationStrategy,
} from "../src/internal.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

function createBot(
  storage: JsonStorageAdapter<DialogStorageRecord>,
  presentation: PresentationStrategy,
) {
  const vm = viewModel({
    initialState: { count: 0 },
    load: ({ state }) => state,
    intents: {
      increment({ state }) {
        state.update((current) => ({ count: current.count + 1 }));
      },
    },
  });
  const card = window("presentation-card", {
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
  const bot = new Bot<TestContext>("test-token");
  bot.use(
    dialogs<TestContext>({
      list: [card],
      storage,
      defaults: { presentation },
    }),
  );
  bot.command("card", (ctx) => ctx.ui.show("presentation-card"));
  return bot;
}

describe("presentation strategies", () => {
  test("replace sends a new surface and deletes the old one", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(
      createBot(storage, presentations.replace()),
    );
    const user = chats.newUser();
    await user.sendCommand("card");
    const oldSurface = user.replies.lastOrThrow();
    chats.outgoing.clear();
    await oldSurface.clickButton("Increment");

    expect(chats.outgoing.getMethods()).toContain("sendMessage");
    expect(chats.outgoing.getMethods()).toContain("deleteMessage");
    expect(chats.outgoing.getMethods()).not.toContain("editMessageText");
  });

  test("send keeps the old message but detaches its keyboard", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(
      createBot(storage, presentations.send()),
    );
    const user = chats.newUser();
    await user.sendCommand("card");
    const oldSurface = user.replies.lastOrThrow();
    chats.outgoing.clear();
    await oldSurface.clickButton("Increment");

    expect(chats.outgoing.getMethods()).toContain("sendMessage");
    expect(chats.outgoing.getMethods()).toContain("editMessageReplyMarkup");
    expect(chats.outgoing.getMethods()).not.toContain("deleteMessage");
  });

  test("auto falls back from an uneditable message to replacement", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const { chats } = await prepareBot(
      createBot(storage, presentations.auto()),
    );
    const user = chats.newUser();
    await user.sendCommand("card");
    const oldSurface = user.replies.lastOrThrow();
    chats.outgoing.clear();
    chats.outgoing.failNext("editMessageText", {
      code: 400,
      description: "Bad Request: message can't be edited",
    });
    await oldSurface.clickButton("Increment");

    expect(chats.outgoing.getMethods()).toContain("editMessageText");
    expect(chats.outgoing.getMethods()).toContain("sendMessage");
    expect(chats.outgoing.getMethods()).toContain("deleteMessage");
    const instance = [...storage.readAllValues()].find(
      (record) => record.type === "instance",
    );
    expect(
      instance?.type === "instance" ? instance.value.state : undefined,
    ).toEqual({ count: 1 });
  });
});
