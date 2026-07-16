import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import type { Chat, User } from "grammy/types";
import { prepareBot } from "grammy-testing";
import {
  access,
  button,
  defineDialog,
  dialogs,
  go,
  scopes,
  textInput,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/index.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

function sharedDialog() {
  const sharedVm = viewModel({
    initialState: { value: "none" },
    load: ({ state }) => state,
    intents: {
      setValue({ state, value }) {
        state.update(current => ({ ...current, value: String(value) }));
      },
    },
  });
  const main = window("shared.main", {
    viewModel: sharedVm,
    text: "Shared",
    keyboard: [[button("Enter value", go("input"))]],
  });
  const input = window("shared.input", {
    viewModel: sharedVm,
    text: ({ vm }) => `Value: ${vm.value}`,
    input: [textInput("value", { onReceive: "setValue" })],
  });
  return defineDialog({
    id: "shared",
    initial: "main",
    windows: { main, input },
    scope: scopes.chat(),
    access: access.everyone(),
  });
}

function createSharedBot(storage?: JsonStorageAdapter<DialogStorageRecord>) {
  const bot = new Bot<TestContext>("test-token");
  bot.use(dialogs<TestContext>({ list: [sharedDialog()], storage }));
  bot.command("shared", ctx => ctx.dialog.start("shared"));
  return bot;
}

async function clickAs(
  bot: Bot<TestContext>,
  group: { toTelegramChat(): Chat },
  member: Pick<User, "id" | "first_name">,
  reply: { messageId: number; buttons: Array<{ callbackData?: string }> },
  updateId: number,
): Promise<void> {
  await bot.handleUpdate({
    update_id: updateId,
    callback_query: {
      id: `shared-input-${updateId}`,
      from: { id: member.id, is_bot: false, first_name: member.first_name },
      chat_instance: "shared-chat",
      data: reply.buttons[0]!.callbackData!,
      message: {
        message_id: reply.messageId,
        date: 0,
        chat: group.toTelegramChat(),
      },
    },
  });
}

describe("group dialogs", () => {
  test("focuses a shared input for the callback actor", async () => {
    const bot = createSharedBot();
    const { chats } = await prepareBot(bot);
    const group = chats.newGroup();
    const owner = chats.newUser({ first_name: "Owner" });
    const member = chats.newUser({ first_name: "Member" });
    group.own(owner);
    group.join(member);
    await owner.sendCommand("shared", undefined, { chat: group });
    const reply = group.messages.last!;

    await clickAs(bot, group, member, reply, 999_001);

    expect(chats.editsFor(member).lastOrThrow().text).toBe("Value: none");
    await member.sendText("from member", { chat: group });
    expect(chats.editsFor(member).lastOrThrow().text).toBe("Value: from member");
  });

  test("does not commit an action when focus preparation fails", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = createSharedBot(storage);
    const { chats } = await prepareBot(bot);
    const group = chats.newGroup();
    const owner = chats.newUser({ first_name: "Owner" });
    const member = chats.newUser({ first_name: "Member" });
    group.own(owner);
    group.join(member);
    await owner.sendCommand("shared", undefined, { chat: group });
    const reply = group.messages.last!;
    storage.failNextWrite("gd:focus:");

    await expect(clickAs(bot, group, member, reply, 999_002))
      .rejects.toThrow("storage write failed");

    const instance = [...storage.readAllValues()].find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.revision : undefined).toBe(0);
    expect(instance?.type === "instance" ? instance.value.stack.at(-1)?.windowId : undefined)
      .toBe("shared.main");

    await expect(clickAs(bot, group, member, reply, 999_003)).resolves.toBeUndefined();
    expect(chats.editsFor(member).lastOrThrow().text).toBe("Value: none");
  });

  test("restores focus when the action instance commit fails", async () => {
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = createSharedBot(storage);
    const { chats } = await prepareBot(bot);
    const group = chats.newGroup();
    const owner = chats.newUser({ first_name: "Owner" });
    const member = chats.newUser({ first_name: "Member" });
    group.own(owner);
    group.join(member);
    await owner.sendCommand("shared", undefined, { chat: group });
    const reply = group.messages.last!;
    storage.failNextWrite("gd:instance:");

    await expect(clickAs(bot, group, member, reply, 999_004))
      .rejects.toThrow("storage write failed");

    expect(storage.read(`gd:focus:${group.id}:root:${member.id}`)).toBeUndefined();
    const instance = [...storage.readAllValues()].find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.focusedUserIds : undefined)
      .not.toContain(member.id);
    expect(instance?.type === "instance" ? instance.value.stack.at(-1)?.windowId : undefined)
      .toBe("shared.main");
  });
});
