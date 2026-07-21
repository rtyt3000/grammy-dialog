import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  createDialogKit,
  defineDialogExtension,
  Text,
} from "../src/internal.js";
import type { TestContext } from "./helpers.js";

describe("DialogKit", () => {
  test("collects resources and creates middleware without a list", async () => {
    const dsl = createDialogKit<TestContext>();
    const dialogVm = dsl.viewModel({ initialState: {} });
    const dialog = dsl.dialog("kit-dialog", {
      viewModel: dialogVm,
      windows: ({ window }) => ({
        main: window("main", {
          view: <Text>Registered dialog</Text>,
        }),
      }),
    });
    const notice = dsl.window("kit.notice", {
      view: <Text>Registered window</Text>,
    });
    const kit = dsl.define(() => ({ dialog, notice }));
    const bot = new Bot<TestContext>("test-token");

    bot.use(kit.middleware({}));
    bot.command("dialog", (ctx) => ctx.dialog.start(kit.dialogs.dialog));
    bot.command("window", (ctx) => ctx.ui.show(kit.windows.notice));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("dialog");
    expect(user.replies.lastOrThrow().text).toBe("Registered dialog");
    await user.sendCommand("window");
    expect(user.replies.lastOrThrow().text).toBe("Registered window");
    expect(kit.dialogs.dialog.windows.main?.id).toBe("kit-dialog.main");
  });

  test("rejects duplicate catalog names", () => {
    const kit = createDialogKit().extend(({ window }) => ({
      windows: {
        custom: window("custom-window", { view: <Text>First</Text> }),
      },
    }));
    const duplicate = defineDialogExtension(({ window }) => ({
      windows: {
        custom: window("other-window", { view: <Text>Second</Text> }),
      },
    }));

    expect(() => kit.use(duplicate)).toThrow("Duplicate window name: custom");
  });

  test("rejects duplicate resource ids while composing the kit", () => {
    const dsl = createDialogKit();
    const first = dsl.window("duplicate-window", { view: <Text>First</Text> });
    const second = dsl.window("duplicate-window", {
      view: <Text>Second</Text>,
    });

    expect(() => dsl.define(() => ({ first, second }))).toThrow(
      "Duplicate window id: duplicate-window",
    );
  });

  test("allows a standalone extension to contribute a nested dialog without a bot", () => {
    const extension = defineDialogExtension(({ dialog, viewModel }) => {
      const help = dialog("plugin-help", {
        viewModel: viewModel({ initialState: {} }),
        windows: ({ window }) => ({
          main: window("main", { view: <Text>Plugin help</Text> }),
        }),
      });
      return { dialogs: { help } };
    });
    const kit = createDialogKit().use(extension);

    expect(kit.dialogs.help.id).toBe("plugin-help");
    expect(kit.dialogs.help.windows.main?.id).toBe("plugin-help.main");
  });
});
