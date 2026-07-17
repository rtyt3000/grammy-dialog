import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import { dialogs, photo, window } from "../src/internal.js";
import type { TestContext } from "./helpers.js";

describe("static windows", () => {
  test("does not require a ViewModel and sends text parse mode", async () => {
    const staticWindow = window("static-text", {
      text: "<b>Static</b>",
      parseMode: "HTML",
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [staticWindow] }));
    bot.command("static", ctx => ctx.ui.show("static-text"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("static");

    const request = chats.outgoing.requests.find(entry => entry.method === "sendMessage");
    expect((request?.payload as { parse_mode?: string } | undefined)?.parse_mode).toBe("HTML");
  });

  test("applies parse mode to media captions", async () => {
    const staticWindow = window("static-media", {
      text: "*Caption*",
      parseMode: "MarkdownV2",
      media: photo("photo-file"),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [staticWindow] }));
    bot.command("media", ctx => ctx.ui.show("static-media"));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("media");

    const request = chats.outgoing.requests.find(entry => entry.method === "sendPhoto");
    expect((request?.payload as { parse_mode?: string } | undefined)?.parse_mode)
      .toBe("MarkdownV2");
  });
});
