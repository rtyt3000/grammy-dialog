import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  Button,
  dialogs,
  intent,
  Keyboard,
  Photo,
  photoInput,
  Row,
  Text,
  viewModel,
  window,
} from "../src/internal.js";
import type { TestContext } from "./helpers.js";

describe("media and i18n", () => {
  test("renders translations with one locale and sends a photo", async () => {
    const cardVm = viewModel({
      initialState: { fileId: "photo-file" },
      load: ({ state }) => state,
      intents: {
        replacePhoto({ state, value }) {
          state.update((current) => ({
            ...current,
            fileId: String((value as { fileId: string }).fileId),
          }));
        },
      },
    });
    const card = window("card", {
      viewModel: cardVm,
      view: async ({ vm, t }) => (
        <>
          <Text>{await t("card.title", { product: "Tea" })}</Text>
          <Photo source={vm.fileId} />
          <Keyboard>
            <Row>
              <Button
                action={intent("replacePhoto", { fileId: "button-photo" })}
              >
                {await t("card.refresh")}
              </Button>
            </Row>
          </Keyboard>
        </>
      ),
      input: [photoInput("replacement", { onReceive: "replacePhoto" })],
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(
      dialogs<TestContext>({
        list: [card],
        i18n: {
          locale: { resolve: () => "pl" },
          adapter: {
            translate: (locale, key, params) =>
              `${locale}:${key}:${params?.product ?? ""}`,
          },
        },
      }),
    );
    bot.command("card", (ctx) => ctx.ui.show("card"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("card");
    const reply = user.replies.lastOrThrow();
    expect(reply.media?.type).toBe("photo");
    expect(reply.text).toBe("pl:card.title:Tea");
    expect(reply.buttons[0]?.text).toBe("pl:card.refresh:");
  });

  test("changes the stack locale immediately", async () => {
    const vm = viewModel({
      initialState: {},
      load: ({ state }) => state,
      intents: {},
    });
    const localized = window("localized", {
      viewModel: vm,
      view: async ({ t }) => <Text>{await t("title")}</Text>,
    });
    const bot = new Bot<TestContext>("test-token");
    let instanceId = "";
    bot.use(
      dialogs<TestContext>({
        list: [localized],
        i18n: {
          locale: { resolve: () => "en" },
          adapter: { translate: (locale, key) => `${locale}:${key}` },
        },
      }),
    );
    bot.command("localized", async (ctx) => {
      instanceId = (await ctx.ui.show("localized")).id;
    });
    bot.command("polish", (ctx) => ctx.dialog.setLocale(instanceId, "pl"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("localized");
    expect(user.replies.lastOrThrow().text).toBe("en:title");
    await user.sendCommand("polish");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("pl:title");
  });
});
