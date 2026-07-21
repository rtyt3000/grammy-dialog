import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  Button,
  defineKeyboardWidget,
  defineWidget,
  dialogs,
  Keyboard,
  Row,
  Text,
  viewModel,
  window,
} from "../src/internal.js";
import type { TestContext } from "./helpers.js";
import { WindowRenderer } from "../src/runtime/window-renderer.js";
import type { InstanceRecord } from "../src/persistence/storage.js";

describe("custom widgets", () => {
  test("runs a stateful keyboard widget", async () => {
    const Counter = defineWidget<{ label: string; step: number }, number>()({
      state: { initial: () => 0 },
      actions: {
        increment({ state, props }) {
          state.update((value) => value + props.step);
        },
      },
      render: ({ state, actions, props }) => (
        <Row>
          <Button action={actions.increment()}>
            {props.label}: {state.value}
          </Button>
        </Row>
      ),
    });
    const vm = viewModel();
    const custom = window("custom", {
      viewModel: vm,
      view: (
        <>
          <Text>Custom widget</Text>
          <Keyboard>
            <Counter id="first" label="First" step={1} />
            <Counter id="second" label="Second" step={2} />
          </Keyboard>
        </>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [custom] }));
    bot.command("custom", (ctx) => ctx.ui.show("custom"));

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("custom");
    const reply = user.replies.lastOrThrow();
    expect(reply.buttons.map((button) => button.text)).toEqual([
      "First: 0",
      "Second: 0",
    ]);
    await reply.clickButton("Second: 0");
    const edit = chats.editsFor(user).lastOrThrow();
    expect(
      (
        edit.raw.reply_markup as {
          inline_keyboard: Array<Array<{ text: string }>>;
        }
      ).inline_keyboard.map((row) => row[0]?.text),
    ).toEqual(["First: 0", "Second: 2"]);
  });

  test("runs callbacks from a nested stateful widget", async () => {
    const Child = defineWidget<{}, number>()({
      state: { initial: () => 0 },
      actions: {
        increment({ state }) {
          state.update((value) => value + 1);
        },
      },
      render: ({ state, actions }) => (
        <Row>
          <Button action={actions.increment()}>Nested: {state.value}</Button>
        </Row>
      ),
    });
    const Parent = defineWidget<{}, null>()({
      state: { initial: () => null },
      actions: {},
      render: () => <Child id="child" />,
    });
    const nested = window("nested-widget", {
      view: (
        <>
          <Text>Nested widget</Text>
          <Keyboard>
            <Parent id="parent" />
          </Keyboard>
        </>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [nested] }));
    bot.command("nested", (ctx) => ctx.ui.show(nested));
    const { chats } = await prepareBot(bot);
    const user = chats.newUser();

    await user.sendCommand("nested");
    await user.replies.lastOrThrow().clickButton("Nested: 0");

    const edit = chats.editsFor(user).lastOrThrow();
    expect(
      (
        edit.raw.reply_markup as {
          inline_keyboard: Array<Array<{ text: string }>>;
        }
      ).inline_keyboard[0]?.[0]?.text,
    ).toBe("Nested: 1");
  });

  test("rejects duplicate state namespaces in a composed keyboard", async () => {
    const Counter = defineWidget<{}, number>()({
      state: { initial: () => 0 },
      actions: {},
      render: () => [],
    });
    const duplicate = window("duplicate-widget", {
      view: (
        <>
          <Text>Duplicate</Text>
          <Keyboard>
            <Counter id="same" />
            <Counter id="same" />
          </Keyboard>
        </>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [duplicate] }));
    bot.command("duplicate", (ctx) => ctx.ui.show(duplicate));
    const { chats } = await prepareBot(bot);

    await expect(chats.newUser().sendCommand("duplicate")).rejects.toThrow(
      "Duplicate keyboard widget id: same",
    );
  });

  test("rejects duplicate state namespaces in an expanded widget tree", async () => {
    const Child = defineWidget<{}, null>()({
      state: { initial: () => null },
      actions: {},
      render: () => [],
    });
    const Parent = defineWidget<{}, null>()({
      state: { initial: () => null },
      actions: {},
      render: () => <Child id="same" />,
    });
    const duplicate = window("nested-duplicate-widget", {
      view: (
        <>
          <Text>Duplicate nested widget</Text>
          <Keyboard>
            <Parent id="parent" />
            <Child id="same" />
          </Keyboard>
        </>
      ),
    });
    const bot = new Bot<TestContext>("test-token");
    bot.use(dialogs<TestContext>({ list: [duplicate] }));
    bot.command("duplicate", (ctx) => ctx.ui.show(duplicate));
    const { chats } = await prepareBot(bot);

    await expect(chats.newUser().sendCommand("duplicate")).rejects.toThrow(
      "Duplicate keyboard widget id: same",
    );
  });

  test("migrates versioned widget state", () => {
    const counter = defineKeyboardWidget<{}, number>()({
      state: {
        version: 2,
        initial: () => 0,
        migrate: (value, fromVersion) =>
          fromVersion === 1 ? Number(value) + 10 : 0,
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

    expect(renderer.widgetState(instance, counter("counter", {})).value).toBe(
      15,
    );
    expect(instance.widgetStates.counter).toEqual({ version: 2, value: 15 });
  });
});
