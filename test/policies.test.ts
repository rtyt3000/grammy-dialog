import { describe, expect, test } from "bun:test";
import { access, scopes } from "../src/internal.js";
import type { TestContext } from "./helpers.js";

describe("scope and access policies", () => {
  test("accepts resolver and predicate functions for custom policies", async () => {
    const scope = scopes.custom<TestContext>(ctx => ({
      key: `custom:${ctx.chat!.id}`,
      chatId: ctx.chat!.id,
    }));
    const policy = access.custom<TestContext>((ctx, instance) =>
      ctx.chat?.id === instance.chatId && ctx.from?.id === 42
    );
    const ctx = {
      chat: { id: -100, type: "group" },
      from: { id: 42 },
    } as unknown as TestContext;

    expect(await scope.resolve(ctx)).toEqual({ key: "custom:-100", chatId: -100 });
    expect(await policy.allows(ctx, { id: "instance", chatId: -100 })).toBe(true);
  });

  test("allows only chat creators and administrators", async () => {
    const policy = access.chatAdministrators<TestContext>();
    const instance = { id: "instance", chatId: -100 };
    const context = (status: "creator" | "administrator" | "member") => ({
      chat: { id: -100, type: "group" },
      from: { id: 42 },
      getChatMember: async () => ({ status }),
    }) as unknown as TestContext;

    expect(await policy.allows(context("creator"), instance)).toBe(true);
    expect(await policy.allows(context("administrator"), instance)).toBe(true);
    expect(await policy.allows(context("member"), instance)).toBe(false);
  });
});
