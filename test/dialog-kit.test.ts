import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  createDialogKit,
  defineDialogExtension,
} from "../src/index.js";
import type { TestContext } from "./helpers.js";

describe("DialogKit", () => {
  test("collects extension resources and creates middleware without a list", async () => {
    const counterExtension = defineDialogExtension(({ define }) => ({
      widgets: {
        label: (value: string) => [[define.button(value, "noop")]],
      },
    }));
    const dsl = createDialogKit<TestContext>().use(counterExtension);
    const dialog = dsl.dialog("kit-dialog", ({ window, widgets }) => ({
      windows: {
        main: window("main", {
          text: "Registered dialog",
          keyboard: widgets.label("Action"),
        }),
      },
    }));
    const notice = dsl.window("kit.notice", { text: "Registered window" });
    const kit = dsl.compose(() => ({ dialog, notice }));
    const bot = new Bot<TestContext>("test-token");

    bot.use(kit.middleware({}));
    bot.command("dialog", ctx => ctx.dialog.start(kit.dialogs.dialog));
    bot.command("window", ctx => ctx.ui.show(kit.windows.notice));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("dialog");
    expect(user.replies.lastOrThrow().text).toBe("Registered dialog");
    await user.sendCommand("window");
    expect(user.replies.lastOrThrow().text).toBe("Registered window");
    expect(kit.widgets.label("Action")[0]?.[0]?.text).toBe("Action");
    expect(kit.dialogs.dialog.windows.main?.id).toBe("kit-dialog.main");
  });

  test("rejects duplicate catalog names", () => {
    const kit = createDialogKit().extend(() => ({ widgets: { custom: true } }));
    const duplicate = defineDialogExtension(() => ({ widgets: { custom: false } }));

    expect(() => kit.use(duplicate)).toThrow("Duplicate widget name: custom");
  });

  test("rejects duplicate resource ids while composing the kit", () => {
    const dsl = createDialogKit();
    const first = dsl.window("duplicate-window", { text: "First" });
    const second = dsl.window("duplicate-window", { text: "Second" });

    expect(() => dsl.compose(() => ({ first, second })))
      .toThrow("Duplicate window id: duplicate-window");
  });

  test("allows a standalone extension to contribute a nested dialog without a bot", () => {
    const extension = defineDialogExtension(({ dialog }) => {
      const help = dialog("plugin-help", ({ window }) => ({
        windows: { main: window("main", { text: "Plugin help" }) },
      }));
      return { dialogs: { help } };
    });
    const kit = createDialogKit().use(extension);

    expect(kit.dialogs.help.id).toBe("plugin-help");
    expect(kit.dialogs.help.windows.main?.id).toBe("plugin-help.main");
  });
});
