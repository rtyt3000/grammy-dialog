import { describe, expect, test } from "bun:test";
import { Bot } from "grammy";
import { prepareBot } from "grammy-testing";
import {
  createDialogKit,
  type DialogStorageRecord,
} from "../src/internal.js";
import { JsonStorageAdapter, type TestContext } from "./helpers.js";

describe("scoped instance identity", () => {
  test("creates, reuses, and replaces a keyed dialog instance", async () => {
    const builder = createDialogKit<TestContext>();
    const vm = builder.viewModel({ initialState: { value: "ready" } });
    const keyed = builder.dialog("keyed", {
      viewModel: vm,
      windows: ({ window }) => ({
        main: window("main", { text: ({ vm }) => vm.value }),
      }),
    });
    const app = builder.define(() => ({ keyed }));
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const bot = new Bot<TestContext>("test-token");
    const ids: string[] = [];

    bot.use(app.middleware({ storage }));
    bot.command("reuse", async ctx => {
      ids.push((await ctx.dialog.start(app.dialogs.keyed, {
        key: "primary",
        mode: "reuse",
      })).id);
    });
    bot.command("create", ctx => ctx.dialog.start(app.dialogs.keyed, {
      key: "primary",
      mode: "create",
    }));
    bot.command("replace", async ctx => {
      ids.push((await ctx.dialog.start(app.dialogs.keyed, {
        key: "primary",
        mode: "replace",
      })).id);
    });

    const { chats } = await prepareBot(bot);
    const user = chats.newUser();
    await user.sendCommand("reuse");
    await user.sendCommand("reuse");
    expect(ids[0]).toBe(ids[1]);
    await expect(user.sendCommand("create")).rejects.toThrow("Active instance already exists");

    await user.sendCommand("replace");
    expect(ids[2]).not.toBe(ids[0]);
    const instances = [...storage.readAllValues()]
      .filter(record => record.type === "instance")
      .map(record => record.value);
    expect(instances.find(instance => instance.id === ids[0])?.status).toBe("closed");
    expect(instances.find(instance => instance.id === ids[2])?.status).toBe("active");
  });

  test("serializes create collisions across runtimes sharing a coordinator", async () => {
    const builder = createDialogKit<TestContext>();
    const vm = builder.viewModel({ initialState: {} });
    const keyed = builder.dialog("distributed-keyed", {
      viewModel: vm,
      windows: ({ window }) => ({ main: window("main", { text: "Ready" }) }),
    });
    const app = builder.define(() => ({ keyed }));
    const storage = new JsonStorageAdapter<DialogStorageRecord>();
    const createBot = () => {
      const bot = new Bot<TestContext>("test-token");
      bot.use(app.middleware({ storage }));
      bot.command("create", ctx => ctx.dialog.start(app.dialogs.keyed, {
        key: "shared",
        mode: "create",
      }));
      return bot;
    };
    const first = await prepareBot(createBot());
    const second = await prepareBot(createBot());
    const firstUser = first.chats.newUser();
    const secondUser = second.chats.newUser();

    const results = await Promise.allSettled([
      firstUser.sendCommand("create"),
      secondUser.sendCommand("create"),
    ]);

    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const active = [...storage.readAllValues()].filter(record =>
      record.type === "instance" && record.value.status === "active"
    );
    expect(active).toHaveLength(1);
  });

  test("rejects keyed instances without a shared identity coordinator", async () => {
    const builder = createDialogKit<TestContext>();
    const vm = builder.viewModel({ initialState: {} });
    const keyed = builder.dialog("uncoordinated", {
      viewModel: vm,
      windows: ({ window }) => ({ main: window("main", { text: "Ready" }) }),
    });
    const app = builder.define(() => ({ keyed }));
    const backing = new JsonStorageAdapter<DialogStorageRecord>();
    const storage = {
      read: (key: string) => backing.read(key),
      write: (key: string, value: DialogStorageRecord) => backing.write(key, value),
      delete: (key: string) => backing.delete(key),
    };
    const bot = new Bot<TestContext>("test-token");
    bot.use(app.middleware({ storage }));
    bot.command("keyed", ctx => ctx.dialog.start(app.dialogs.keyed, { key: "primary" }));
    const { chats } = await prepareBot(bot);

    await expect(chats.newUser().sendCommand("keyed"))
      .rejects.toThrow("require a distributed identity coordinator");
  });
});
