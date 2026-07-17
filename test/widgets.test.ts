import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  button,
  defineKeyboardWidget,
  dialogs,
  keyboard,
  viewModel,
  window,
} from "../src/internal.js";
import type { TestContext } from "./helpers.js";
import { WindowRenderer } from "../src/runtime/window-renderer.js";
import type { InstanceRecord } from "../src/persistence/storage.js";

describe("custom widgets", () => {
  test("runs a stateful keyboard widget", async () => {
    const counter = defineKeyboardWidget<{ label: string; step: number }, number>()({
      state: { initial: () => 0 },
      actions: {
        increment({ state, props }) {
          state.update(value => value + props.step);
        },
      },
      render({ state, actions, props }) {
        return [[button(`${props.label}: ${state.value}`, actions.increment())]];
      },
    });
    const vm = viewModel();
    const custom = window("custom", {
      viewModel: vm,
      text: "Custom widget",
      keyboard: keyboard(
        counter("first", { label: "First", step: 1 }),
        counter("second", { label: "Second", step: 2 }),
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [custom] }));
    bot.command("custom", ctx => ctx.ui.show("custom"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("custom");
    const reply = user.replies.lastOrThrow();
    expect(reply.buttons.map(button => button.text)).toEqual(["First: 0", "Second: 0"]);
    await reply.clickButton("Second: 0");
    const edit = chats.editsFor(user).lastOrThrow();
    expect((edit.raw.reply_markup as { inline_keyboard: Array<Array<{ text: string }>> })
      .inline_keyboard.map(row => row[0]?.text)).toEqual(["First: 0", "Second: 2"]);
  });

  test("rejects duplicate state namespaces in a composed keyboard", async () => {
    const counter = defineKeyboardWidget<{}, number>()({
      state: { initial: () => 0 },
      actions: {},
      render: () => [],
    });
    const duplicate = window("duplicate-widget", {
      text: "Duplicate",
      keyboard: keyboard(counter("same", {}), counter("same", {})),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [duplicate] }));
    bot.command("duplicate", ctx => ctx.ui.show(duplicate));
    const { chats } = await prepareBot(bot);

    await expect(chats.newUser().sendCommand("duplicate"))
      .rejects.toThrow("Duplicate keyboard widget id: same");
  });

  test("migrates versioned widget state", () => {
    const counter = defineKeyboardWidget<{}, number>()({
      state: {
        version: 2,
        initial: () => 0,
        migrate: (value, fromVersion) => fromVersion === 1 ? Number(value) + 10 : 0,
      },
      actions: {},
      render: () => [],
    });
    const instance: InstanceRecord = {
      id: "instance",
      kind: "standalone",
      definitionId: "window",
      chatId: 1,
      scopeKey: "1",
      stack: [{ windowId: "window" }],
      state: {},
      locale: "en",
      revision: 0,
      status: "active",
      callbackTokens: [],
      widgetStates: { counter: { version: 1, value: 5 } },
      focusedUserIds: [],
    };
    const renderer = new WindowRenderer({
      registry: {} as never,
      repository: {} as never,
      services: undefined,
      codec: {} as never,
      callbackTtlMs: 1,
    });

    expect(renderer.widgetState(instance, counter("counter", {})).value).toBe(15);
    expect(instance.widgetStates.counter).toEqual({ version: 2, value: 15 });
  });
});
