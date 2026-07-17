import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  button,
  defineKeyboardWidget,
  dialogs,
  viewModel,
  window,
} from "../src/index.js";
import type { TestContext } from "./helpers.js";

describe("custom widgets", () => {
  test("runs a stateful keyboard widget", async () => {
    const counter = defineKeyboardWidget<{ step: number }, number>()({
      state: { initial: () => 0 },
      actions: {
        increment({ state, props }) {
          state.update(value => value + props.step);
        },
      },
      render({ state, actions }) {
        return [[button(`Widget: ${state.value}`, actions.increment())]];
      },
    });
    const vm = viewModel();
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
});
