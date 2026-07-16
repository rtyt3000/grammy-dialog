import { describe, expect, test } from "bun:test";
import { Bot, type Context } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  access,
  back,
  button,
  defineDialog,
  defineInputWidget,
  defineKeyboardWidget,
  dialogs,
  go,
  intent,
  MemoryStorageAdapter,
  photo,
  photoInput,
  scopes,
  t,
  textInput,
  valid,
  viewModel,
  window,
  type DialogFlavor,
  type DialogStorageRecord,
} from "../src/index.js";

type TestContext = Context & DialogFlavor;

describe("dialog runtime", () => {
  test("starts a dialog and rerenders after an opaque callback intent", async () => {
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
    const counter = defineDialog({
      id: "counter",
      initial: "main",
      windows: { main },
    });
    const bot = new Bot<TestContext>("test-token");
    const storage = new MemoryStorageAdapter<DialogStorageRecord>();
    bot.use(dialogs<TestContext>({ list: [counter], storage }));
    bot.command("counter", ctx => ctx.dialog.start("counter"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("counter");

    const reply = user.replies.lastOrThrow();
    expect(reply.text).toBe("Count: 0");
    expect(reply.buttons[0]?.callbackData).toMatch(/^gd:[a-f0-9]{32}$/);

    await reply.clickButton("Increment");

    expect(chats.editsFor(user).lastOrThrow().text).toBe("Count: 1");
  });

  test("navigates with a stack and accepts focused text input", async () => {
    const formVm = viewModel({
      initialState: { name: "" },
      load: ({ state }) => state,
      intents: {
        saveName({ state, value }) {
          state.update(current => ({ ...current, name: String(value) }));
        },
      },
    });
    const main = window("form.main", {
      viewModel: formVm,
      text: "Profile",
      keyboard: [[button("Edit", go("edit"))]],
    });
    const edit = window("form.edit", {
      viewModel: formVm,
      text: ({ vm }) => vm.name === "" ? "Enter name" : `Name: ${vm.name}`,
      keyboard: [[button("Back", back())]],
      input: [textInput("name", {
        trim: true,
        validate: value => value.length > 1 ? valid(value) : { ok: false, message: "Too short" },
        onReceive: "saveName",
      })],
    });
    const form = defineDialog({
      id: "form",
      initial: "main",
      windows: { main, edit },
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [form] }));
    bot.command("form", ctx => ctx.dialog.start("form"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("form");
    await user.replies.lastOrThrow().clickButton("Edit");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("Enter name");

    await user.sendText(" Alice ");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("Name: Alice");
  });

  test("renders translations with one locale and sends a photo window", async () => {
    const cardVm = viewModel({
      initialState: { fileId: "photo-file" },
      load: ({ state }) => state,
      intents: {
        replacePhoto({ state, value }) {
          state.update(current => ({ ...current, fileId: String((value as { fileId: string }).fileId) }));
        },
      },
    });
    const card = window("card", {
      viewModel: cardVm,
      text: t("card.title", { product: "Tea" }),
      media: ({ vm }) => photo(vm.fileId),
      input: [photoInput("replacement", { onReceive: "replacePhoto" })],
      keyboard: [[button(t("card.refresh"), intent("replacePhoto", { fileId: "button-photo" }))]],
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({
      list: [card],
      i18n: {
        locale: { resolve: () => "pl" },
        adapter: {
          translate(locale, key, params) {
            return `${locale}:${key}:${params?.product ?? ""}`;
          },
        },
      },
    }));
    bot.command("card", ctx => ctx.ui.show("card"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("card");

    const reply = user.replies.lastOrThrow();
    expect(reply.media?.type).toBe("photo");
    expect(reply.text).toBe("pl:card.title:Tea");
    expect(reply.buttons[0]?.text).toBe("pl:card.refresh:");
  });

  test("runs a user-defined stateful keyboard widget", async () => {
    const counter = defineKeyboardWidget<{ step: number }, number>()({
      state: {
        version: 1,
        initial: () => 0,
      },
      actions: {
        increment({ state, props }) {
          state.update(value => value + props.step);
        },
      },
      render({ state, actions }) {
        return [[button(`Widget: ${state.value}`, actions.increment())]];
      },
    });
    const vm = viewModel({
      initialState: {},
      load: ({ state }) => state,
      intents: {},
    });
    const custom = window("custom", {
      viewModel: vm,
      text: "Custom widget",
      keyboard: counter({ id: "counter", step: 2 }),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [custom] }));
    bot.command("custom", ctx => ctx.ui.show("custom"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("custom");
    const reply = user.replies.lastOrThrow();
    expect(reply.buttons[0]?.text).toBe("Widget: 0");

    await reply.clickButton("Widget: 0");
    const edit = chats.editsFor(user).lastOrThrow();
    expect((edit.raw.reply_markup as { inline_keyboard: Array<Array<{ text: string }>> })
      .inline_keyboard[0]?.[0]?.text).toBe("Widget: 2");
  });

  test("allows another member to use a chat-scoped shared dialog", async () => {
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
    const shared = defineDialog({
      id: "shared",
      initial: "main",
      windows: { main, input },
      scope: scopes.chat(),
      access: access.everyone(),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [shared] }));
    bot.command("shared", ctx => ctx.dialog.start("shared"));

    const { chats } = await prepareBot(bot);
    const group = chats.newGroup();
    const owner = chats.newUser({ first_name: "Owner" });
    const member = chats.newUser({ first_name: "Member" });
    group.own(owner);
    group.join(member);
    await owner.sendCommand("shared", undefined, { chat: group });
    const reply = group.messages.last;
    expect(reply?.text).toBe("Shared");
    const callbackData = reply?.buttons[0]?.callbackData;
    expect(callbackData).toBeDefined();

    await bot.handleUpdate({
      update_id: 999_001,
      callback_query: {
        id: "shared-input",
        from: {
          id: member.id,
          is_bot: false,
          first_name: member.first_name,
        },
        chat_instance: "shared-chat",
        data: callbackData!,
        message: {
          message_id: reply!.messageId,
          date: 0,
          chat: group.toTelegramChat(),
        },
      },
    });

    expect(chats.editsFor(member).lastOrThrow().text).toBe("Value: none");
    await member.sendText("from member", { chat: group });
    expect(chats.editsFor(member).lastOrThrow().text).toBe("Value: from member");
  });

  test("uses a custom input widget and changes the stack locale immediately", async () => {
    const hashtagInput = defineInputWidget<Record<never, never>, string>()({
      match: ctx => ctx.message?.text?.startsWith("#") ?? false,
      parse: ctx => ctx.message!.text!.slice(1),
    });
    const vm = viewModel({
      initialState: { tag: "none" },
      load: ({ state }) => state,
      intents: {
        setTag({ state, value }) {
          state.update(current => ({ ...current, tag: String(value) }));
        },
      },
    });
    const customInputWindow = window("custom-input", {
      viewModel: vm,
      text: ({ vm, t }) => t("tag", { value: vm.tag }),
      input: [hashtagInput({ id: "hashtag", onReceive: "setTag" })],
    });
    const bot = new Bot<TestContext>("test-token");
    let instanceId = "";
    bot.use(dialogs<TestContext>({
      list: [customInputWindow],
      i18n: {
        locale: { resolve: () => "en" },
        adapter: {
          translate: (locale, key, params) => `${locale}:${key}:${params?.value}`,
        },
      },
    }));
    bot.command("input", async ctx => {
      instanceId = (await ctx.ui.show("custom-input")).id;
    });
    bot.command("polish", ctx => ctx.dialog.setLocale(instanceId, "pl"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("input");
    expect(user.replies.lastOrThrow().text).toBe("en:tag:none");

    await user.sendText("#typescript");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("en:tag:typescript");

    await user.sendCommand("polish");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("pl:tag:typescript");
  });

  test("keeps topic output and focused input inside their message thread", async () => {
    const topicVm = viewModel({
      initialState: { withPhoto: false },
      load: ({ state }) => state,
      intents: {
        attach({ state }) {
          state.update(current => ({ ...current, withPhoto: true }));
        },
      },
    });
    const topicWindow = window("topic.main", {
      viewModel: topicVm,
      text: ({ vm }) => vm.withPhoto ? "With photo" : "Without photo",
      media: ({ vm }) => vm.withPhoto ? photo("topic-photo") : undefined,
      input: [textInput("attach", { onReceive: "attach" })],
    });
    const topicDialog = defineDialog({
      id: "topic",
      initial: "main",
      windows: { main: topicWindow },
      scope: scopes.topic(),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [topicDialog] }));
    bot.command("topic", ctx => ctx.dialog.start("topic"));

    const { chats } = await prepareBot(bot);
    const group = chats.newSupergroup();
    const user = chats.newUser({ first_name: "Topic user" });
    group.own(user);

    const sendTopicMessage = async (text: string, threadId: number, updateId: number) => {
      await bot.handleUpdate({
        update_id: updateId,
        message: {
          message_id: updateId,
          date: 0,
          chat: { ...group.toTelegramChat(), is_forum: true },
          from: {
            id: user.id,
            is_bot: false,
            first_name: user.first_name,
          },
          message_thread_id: threadId,
          is_topic_message: true,
          text,
          ...(text.startsWith("/") ? {
            entities: [{ type: "bot_command" as const, offset: 0, length: text.length }],
          } : {}),
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
    const sendPhotoRequest = chats.outgoing.requests.find(request => request.method === "sendPhoto");
    expect((sendPhotoRequest?.payload as { message_thread_id?: number } | undefined)?.message_thread_id).toBe(11);
    const deleteRequest = chats.outgoing.requests.find(request => request.method === "deleteMessage");
    expect((deleteRequest?.payload as { message_id?: number } | undefined)?.message_id).toBe(firstSurface.messageId);
  });

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
    const instance = [...storage.readAllValues()]
      .find(record => record.type === "instance");
    expect(instance?.type === "instance" ? instance.value.status : undefined).toBe("closed");
    expect([...storage.readAllKeys()].some(key => key.startsWith("gd:focus:"))).toBe(false);
  });
});
