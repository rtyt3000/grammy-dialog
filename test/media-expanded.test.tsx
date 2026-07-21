import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  Animation,
  Audio,
  Button,
  dialogs,
  Document,
  documentInput,
  Keyboard,
  intent,
  inputRouting,
  Photo,
  Row,
  Text,
  Video,
  videoInput,
  Voice,
  viewModel,
  window,
  type DialogStorageRecord,
} from "../src/internal.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

const staticVm = viewModel({ initialState: {}, load: () => ({}), intents: {} });

describe("expanded media", () => {
  test("sends video, animation, audio, document and voice surfaces", async () => {
    const resources = [
      window("video", {
        viewModel: staticVm,
        view: <Video source="video-file" />,
      }),
      window("animation", {
        viewModel: staticVm,
        view: <Animation source="animation-file" />,
      }),
      window("audio", {
        viewModel: staticVm,
        view: <Audio source="audio-file" />,
      }),
      window("document", {
        viewModel: staticVm,
        view: <Document source="document-file" />,
      }),
      window("voice", {
        viewModel: staticVm,
        view: <Voice source="voice-file" />,
      }),
    ];
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: resources }));
    for (const resource of resources) {
      bot.command(resource.id, (ctx) => ctx.ui.show(resource.id));
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
          state.update((current) => ({ ...current, video: true }));
        },
      },
    });
    const mediaCard = window("media-transition", {
      viewModel: vm,
      view: ({ vm }) => (
        <>
          {vm.video ? (
            <Video source="video-file" />
          ) : (
            <Photo source="photo-file" />
          )}
          <Keyboard>
            <Row>
              <Button action={intent<undefined>("switch")}>Switch</Button>
            </Row>
          </Keyboard>
        </>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [mediaCard] }));
    bot.command("media", (ctx) => ctx.ui.show("media-transition"));
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
          state.update((current) => ({
            ...current,
            fileId: String((value as { fileId: string }).fileId),
          }));
        },
      },
    });
    const videoWindow = window("video-input", {
      viewModel: inputVm,
      view: ({ vm }) => <Text>{vm.fileId}</Text>,
      input: [videoInput("video", { onReceive: "receive" })],
    });
    const documentWindow = window("document-input", {
      viewModel: inputVm,
      view: ({ vm }) => <Text>{vm.fileId}</Text>,
      input: [documentInput("document", { onReceive: "receive" })],
    });
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    bot.use(
      dialogs<TestContext>({
        list: [videoWindow, documentWindow],
        storage,
        defaults: { inputRouting: inputRouting.latest() },
      }),
    );
    bot.command("video", (ctx) => ctx.ui.show("video-input"));
    bot.command("document", (ctx) => ctx.ui.show("document-input"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("video");
    await user.sendVideo("incoming-video");
    await user.sendCommand("document");
    await user.sendDocument("incoming-document");

    const states = [...storage.readAllValues()]
      .filter((record) => record.type === "instance")
      .map((record) =>
        record.type === "instance" ? record.value.state : undefined,
      );
    expect(states).toContainEqual({ fileId: "incoming-video" });
    expect(states).toContainEqual({ fileId: "incoming-document" });
  });
});
