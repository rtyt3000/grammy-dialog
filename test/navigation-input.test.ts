import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  back,
  button,
  defineDialog,
  defineInputWidget,
  dialogs,
  go,
  textInput,
  valid,
  viewModel,
  window,
} from "../src/index.js";
import type { TestContext } from "./helpers.js";

describe("navigation and input", () => {
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
    const form = defineDialog({ id: "form", initial: "main", windows: { main, edit } });
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

  test("accepts a user-defined input widget", async () => {
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
    const inputWindow = window("custom-input", {
      viewModel: vm,
      text: ({ vm }) => `Tag: ${vm.tag}`,
      input: [hashtagInput({ id: "hashtag", onReceive: "setTag" })],
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [inputWindow] }));
    bot.command("input", ctx => ctx.ui.show("custom-input"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("input");
    await user.sendText("#typescript");
    expect(chats.editsFor(user).lastOrThrow().text).toBe("Tag: typescript");
  });
});
