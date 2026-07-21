import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  B,
  Button,
  Br,
  Code,
  I,
  Input,
  Keyboard,
  Link,
  Photo,
  Row,
  Spoiler,
  Text,
  TextInput,
  UrlButton,
  Window,
  defineWidget,
  dialogs,
  invalid,
  intent,
  valid,
  viewModel,
  window,
} from "../src/internal.js";
import type { TestContext } from "./helpers.js";

describe("minimal JSX views", () => {
  test("renders escaped HTML text and durable callback buttons", async () => {
    const counter = viewModel({
      initialState: { count: 0 },
      load: ({ state }) => state,
      intents: {
        increment({ state }) {
          state.update((current) => ({ count: current.count + 1 }));
        },
      },
    });
    const counterWindow = window("jsx-counter", {
      viewModel: counter,
      view: ({ vm }) => (
        <Window>
          <Text>
            Count: <B>{vm.count}</B> <I>{"<&>"}</I>
          </Text>
          <Keyboard>
            <Row>
              <Button id="increment" action={intent(counter.actions.increment)}>
                +1
              </Button>
              <UrlButton url="https://example.com?a=1&b=2">Docs</UrlButton>
            </Row>
          </Keyboard>
        </Window>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [counterWindow] }));
    bot.command("counter", (ctx) => ctx.ui.show(counterWindow));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("counter");

    const reply = user.replies.lastOrThrow();
    expect(reply.text).toBe("Count: <b>0</b> <i>&lt;&amp;&gt;</i>");
    expect(reply.buttons.map((button) => button.text)).toEqual(["+1", "Docs"]);
    const request = chats.outgoing.requests.find(
      (entry) => entry.method === "sendMessage",
    );
    expect(
      (request?.payload as { parse_mode?: string } | undefined)?.parse_mode,
    ).toBe("HTML");

    await reply.clickButton("+1");

    expect(chats.editsFor(user).lastOrThrow().text).toBe(
      "Count: <b>1</b> <i>&lt;&amp;&gt;</i>",
    );
  });

  test("renders typed Telegram text formatting elements", async () => {
    const formatted = window("jsx-formatting", {
      view: (
        <Window>
          <Text>
            <Link href="https://example.com?a=1&b=2">Docs</Link>
            <Br />
            <Code className="language-ts">const x = 1;</Code>
            <Br />
            <Spoiler>secret</Spoiler>
          </Text>
        </Window>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [formatted] }));
    bot.command("format", (ctx) => ctx.ui.show(formatted));
    const { chats } = await prepareBot(bot);

    await chats.newUser().sendCommand("format");

    expect(
      chats.outgoing.requests.find((entry) => entry.method === "sendMessage")
        ?.payload,
    ).toMatchObject({
      text:
        '<a href="https://example.com?a=1&amp;b=2">Docs</a>\n' +
        '<code class="language-ts">const x = 1;</code>\n' +
        "<tg-spoiler>secret</tg-spoiler>",
    });
  });

  test("validates and normalizes focused text input from JSX", async () => {
    const formVm = viewModel({
      initialState: { value: "" },
      load: ({ state }) => state,
      intents: {
        receive({ state, value }) {
          state.update((current) => ({ ...current, value: String(value) }));
        },
      },
    });
    const form = window("jsx-input", {
      viewModel: formVm,
      view: ({ vm }) => (
        <Window>
          <Text>Value: {vm.value}</Text>
          <Input>
            <TextInput
              receive={formVm.actions.receive}
              trim
              validate={(value) =>
                value.length >= 3
                  ? valid(value.toUpperCase())
                  : invalid("At least 3 characters")
              }
            />
          </Input>
        </Window>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [form] }));
    bot.command("input", (ctx) => ctx.ui.show(form));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("input");
    await user.sendText(" x ");

    expect(user.replies.lastOrThrow().text).toBe("At least 3 characters");
    expect(chats.editsFor(user)).toHaveLength(0);

    await user.sendText(" updated ");

    expect(chats.editsFor(user).lastOrThrow().text).toBe("Value: UPDATED");
  });

  test("supports async components and fragments", async () => {
    async function Greeting({ name }: { name: string }) {
      await Promise.resolve();
      return (
        <Text>
          Hello, <I>{name}</I>
        </Text>
      );
    }

    const asyncWindow = window("jsx-async", {
      view: (
        <>
          <Greeting name="Ada & Bob" />
        </>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [asyncWindow] }));
    bot.command("async", (ctx) => ctx.ui.show(asyncWindow));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("async");

    expect(user.replies.lastOrThrow().text).toBe("Hello, <i>Ada &amp; Bob</i>");
  });

  test("supports an explicit Window root", async () => {
    const rooted = window("jsx-root-window", {
      view: (
        <Window>
          <Text>Rooted</Text>
        </Window>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [rooted] }));
    bot.command("rooted", (ctx) => ctx.ui.show(rooted));
    const { chats } = await prepareBot(bot);

    await chats.newUser().sendCommand("rooted");

    expect(
      chats.outgoing.requests.find((entry) => entry.method === "sendMessage")
        ?.payload,
    ).toMatchObject({ text: "Rooted" });
  });

  test("renders a photo with an HTML caption", async () => {
    const photoWindow = window("jsx-photo", {
      view: (
        <Window>
          <Text>
            Ready: <b>report</b>
          </Text>
          <Photo source="photo-file" />
        </Window>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [photoWindow] }));
    bot.command("photo", (ctx) => ctx.ui.show(photoWindow));
    const { chats } = await prepareBot(bot);

    await chats.newUser().sendCommand("photo");

    const request = chats.outgoing.requests.find(
      (entry) => entry.method === "sendPhoto",
    );
    expect(request?.payload).toMatchObject({
      photo: "photo-file",
      caption: "Ready: <b>report</b>",
      parse_mode: "HTML",
    });
  });

  test("executes a persisted stateful widget mounted in JSX", async () => {
    const Counter = defineWidget<{}, number>()({
      state: { initial: () => 0 },
      actions: {
        increment({ state }) {
          state.update((value) => value + 1);
        },
      },
      render: ({ state, actions }) => (
        <Row>
          <Button action={actions.increment()}>{state.value}</Button>
        </Row>
      ),
    });
    const widgetWindow = window("jsx-widget", {
      view: (
        <Window>
          <Text>Counter</Text>
          <Keyboard>
            <Counter id="count" />
          </Keyboard>
        </Window>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [widgetWindow] }));
    bot.command("widget", (ctx) => ctx.ui.show(widgetWindow));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("widget");
    await user.replies.lastOrThrow().clickButton("0");

    const edit = chats.editsFor(user).lastOrThrow();
    expect(
      (
        edit.raw.reply_markup as {
          inline_keyboard: Array<Array<{ text: string }>>;
        }
      ).inline_keyboard[0]?.[0]?.text,
    ).toBe("1");
  });
});
