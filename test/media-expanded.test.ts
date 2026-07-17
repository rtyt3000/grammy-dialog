import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  animation,
  audio,
  button,
  dialogs,
  document,
  documentInput,
  photo,
  video,
  videoInput,
  viewModel,
  voice,
  window,
  type DialogStorageRecord,
} from "../src/index.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

const staticVm = viewModel({ initialState: {}, load: () => ({}), intents: {} });

describe("expanded media", () => {
  test("sends video, animation, audio, document and voice surfaces", async () => {
    const resources = [
      window("video", { viewModel: staticVm, media: video("video-file") }),
      window("animation", { viewModel: staticVm, media: animation("animation-file") }),
      window("audio", { viewModel: staticVm, media: audio("audio-file") }),
      window("document", { viewModel: staticVm, media: document("document-file") }),
      window("voice", { viewModel: staticVm, media: voice("voice-file") }),
    ];
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: resources }));
    for (const resource of resources) {
      bot.command(resource.id, ctx => ctx.ui.show(resource.id));
    }
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    for (const resource of resources) await user.sendCommand(resource.id);

    expect(chats.outgoing.getMethods()).toContain("sendVideo");
    expect(chats.outgoing.getMethods()).toContain("sendAnimation");
    expect(chats.outgoing.getMethods()).toContain("sendAudio");
    expect(chats.outgoing.getMethods()).toContain("sendDocument");
    expect(chats.outgoing.getMethods()).toContain("sendVoice");
  });

  test("edits between compatible media kinds", async () => {
    const vm = viewModel({
      initialState: { video: false },
      load: ({ state }) => state,
      intents: {
        switch({ state }) {
          state.update(current => ({ ...current, video: true }));
        },
      },
    });
    const mediaCard = window("media-transition", {
      viewModel: vm,
      media: ({ vm }) => vm.video ? video("video-file") : photo("photo-file"),
      keyboard: [[button("Switch", "switch")]],
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [mediaCard] }));
    bot.command("media", ctx => ctx.ui.show("media-transition"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("media");
    const reply = user.replies.lastOrThrow();
    chats.outgoing.clear();

    await reply.clickButton("Switch");

    expect(chats.outgoing.getMethods()).toContain("editMessageMedia");
    expect(chats.outgoing.getMethods()).not.toContain("sendVideo");
  });

  test("normalizes video and document inputs", async () => {
    const inputVm = viewModel({
      initialState: { fileId: "" },
      load: ({ state }) => state,
      intents: {
        receive({ state, value }) {
          state.update(current => ({
            ...current,
            fileId: String((value as { fileId: string }).fileId),
          }));
        },
      },
    });
    const videoWindow = window("video-input", {
      viewModel: inputVm,
      text: ({ vm }) => vm.fileId,
      input: [videoInput("video", { onReceive: "receive" })],
    });
    const documentWindow = window("document-input", {
      viewModel: inputVm,
      text: ({ vm }) => vm.fileId,
      input: [documentInput("document", { onReceive: "receive" })],
    });
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [videoWindow, documentWindow], storage }));
    bot.command("video", ctx => ctx.ui.show("video-input"));
    bot.command("document", ctx => ctx.ui.show("document-input"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("video");
    await user.sendVideo("incoming-video");
    await user.sendCommand("document");
    await user.sendDocument("incoming-document");

    const states = [...storage.readAllValues()]
      .filter(record => record.type === "instance")
      .map(record => record.type === "instance" ? record.value.state : undefined);
    expect(states).toContainEqual({ fileId: "incoming-video" });
    expect(states).toContainEqual({ fileId: "incoming-document" });
  });
});
