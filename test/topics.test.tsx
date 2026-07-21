import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  defineDialog,
  dialogs,
  Photo,
  scopes,
  textInput,
  Text,
  viewModel,
  window,
} from "../src/internal.js";
import type { TestContext } from "./helpers.js";

describe("topic dialogs", () => {
  test("keeps output and focused input inside their message thread", async () => {
    const topicVm = viewModel({
      initialState: { withPhoto: false },
      load: ({ state }) => state,
      intents: {
        attach({ state }) {
          state.update((current) => ({ ...current, withPhoto: true }));
        },
      },
    });
    const topicWindow = window("topic.main", {
      viewModel: topicVm,
      view: ({ vm }) => (
        <>
          <Text>{vm.withPhoto ? "With photo" : "Without photo"}</Text>
          {vm.withPhoto ? <Photo source="topic-photo" /> : null}
        </>
      ),
      input: [textInput("attach", { onReceive: "attach" })],
    });
    const topicDialog = defineDialog({
      id: "topic",
      initial: "main",
      viewModel: topicVm,
      windows: { main: topicWindow },
      scope: scopes.topic(),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [topicDialog] }));
    bot.command("topic", (ctx) => ctx.dialog.start("topic"));

    const { chats } = await prepareBot(bot);
    const group = chats.newSupergroup();
    const user = chats.newUser({ first_name: "Topic user" });
    group.own(user);
    const sendTopicMessage = async (
      text: string,
      threadId: number,
      updateId: number,
    ) => {
      await bot.handleUpdate({
        update_id: updateId,
        message: {
          message_id: updateId,
          date: 0,
          chat: { ...group.toTelegramChat(), is_forum: true },
          from: { id: user.id, is_bot: false, first_name: user.first_name },
          message_thread_id: threadId,
          is_topic_message: true,
          text,
          ...(text.startsWith("/")
            ? {
                entities: [
                  {
                    type: "bot_command" as const,
                    offset: 0,
                    length: text.length,
                  },
                ],
              }
            : {}),
        },
      });
    };

    await sendTopicMessage("/topic", 11, 801_001);
    const firstSurface = group.messages.last!;
    expect(firstSurface.raw.message_thread_id).toBe(11);
    await sendTopicMessage("/topic", 22, 801_002);
    expect(group.messages.last!.raw.message_thread_id).toBe(22);

    chats.outgoing.clear();
    await sendTopicMessage("attach", 11, 801_003);
    const sendPhotoRequest = chats.outgoing.requests.find(
      (request) => request.method === "sendPhoto",
    );
    expect(
      (sendPhotoRequest?.payload as { message_thread_id?: number } | undefined)
        ?.message_thread_id,
    ).toBe(11);
    const deleteRequest = chats.outgoing.requests.find(
      (request) => request.method === "deleteMessage",
    );
    expect(
      (deleteRequest?.payload as { message_id?: number } | undefined)
        ?.message_id,
    ).toBe(firstSurface.messageId);
  });
});
