import type { Context } from "grammy";
import {
  button,
  defineDialog,
  intent,
  valid,
  viewModel,
  window,
  type DialogFlavor,
  type WindowDefinition,
} from "../mod.ts";
import {
  defineInputWidget,
  defineKeyboardWidget,
} from "../widgets.ts";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;

interface Services {
  users: {
    displayName(id: number): Promise<string>;
  };
}

type BotContext = Context & DialogFlavor;
type ProfileState = { name: string; visits: number };
type ProfileView = { title: string; visits: number };

const profileVm = viewModel<ProfileState, ProfileView, BotContext, Services>({
  initialState: { name: "Ada", visits: 0 },
  async load({ state, services, actor }) {
    const displayName = await services.users.displayName(actor.id ?? 0);
    return { title: `${displayName}: ${state.name}`, visits: state.visits };
  },
  intents: {
    visit({ state }) {
      state.update(current => ({ ...current, visits: current.visits + 1 }));
    },
    invalidState({ state }) {
      // @ts-expect-error State updates must preserve ProfileState.
      state.set({ name: "Ada", visits: "once" });
    },
  },
});

const profileWindow = window("profile.main", {
  viewModel: profileVm,
  text: ({ vm, services }) => `${vm.title} (${vm.visits}) ${services.users}`,
  keyboard: [[button("Visit", "visit")]],
});

const staticWindow = window("static", {
  text: ({ vm }) => JSON.stringify(vm),
  parseMode: "HTML",
});
type StaticState = typeof staticWindow extends WindowDefinition<any, infer State, any, any>
  ? State
  : never;
type _StaticStateIsEmpty = Expect<Equal<StaticState, {}>>;

const identityVm = viewModel({ initialState: { count: 0 } });
const identityWindow = window("identity", {
  viewModel: identityVm,
  text: ({ vm }) => String(vm.count),
});
type IdentityView = typeof identityWindow extends WindowDefinition<any, any, infer View, any>
  ? View
  : never;
type _IdentityViewIsState = Expect<Equal<IdentityView, { count: number }>>;

window("static.invalid", {
  // @ts-expect-error Static windows expose an empty view.
  text: ({ vm }) => vm.missing,
});

window("parse-mode.invalid", {
  text: "Invalid",
  // @ts-expect-error Parse mode is limited to Telegram-supported values.
  parseMode: "BBCode",
});

type InferredState = typeof profileWindow extends WindowDefinition<any, infer State, any, any>
  ? State
  : never;
type InferredView = typeof profileWindow extends WindowDefinition<any, any, infer View, any>
  ? View
  : never;
type InferredServices = typeof profileWindow extends WindowDefinition<any, any, any, infer Service>
  ? Service
  : never;
type _StateIsPreserved = Expect<Equal<InferredState, ProfileState>>;
type _ViewIsPreserved = Expect<Equal<InferredView, ProfileView>>;
type _ServicesArePreserved = Expect<Equal<InferredServices, Services>>;

window("profile.invalid", {
  viewModel: profileVm,
  // @ts-expect-error Window render context uses the ViewModel's returned view.
  text: ({ vm }) => vm.missingProperty,
});

const profileDialog = defineDialog({
  id: "profile",
  windows: { main: profileWindow },
});

declare const botContext: BotContext;
botContext.dialog.start(profileDialog);
botContext.ui.show(profileWindow);

intent<{ userId: number }>("open-user", { userId: 42 });
// @ts-expect-error A typed intent payload is required.
intent<{ userId: number }>("open-user");
// @ts-expect-error Intent payload shape is checked.
intent<{ userId: number }>("open-user", { userId: "42" });

const counter = defineKeyboardWidget<{ step: number }, number>()({
  state: {
    initial: props => props.step,
  },
  actions: {
    increment({ state, props }) {
      state.update(value => value + props.step);
    },
  },
  render({ state, actions }) {
    return [[button(String(state.value), actions.increment())]];
  },
});

counter({ id: "counter", step: 2 });
// @ts-expect-error Widget props are required and inferred by the factory.
counter({ id: "counter" });
// @ts-expect-error Unknown widget props are rejected.
counter({ id: "counter", step: 2, extra: true });

defineKeyboardWidget<Record<string, never>, number>()({
  state: { initial: () => 0 },
  actions: { increment({ state }) { state.update(value => value + 1); } },
  render({ actions }) {
    // @ts-expect-error Render exposes only declared widget actions.
    return [[button("Unknown", actions.decrement())]];
  },
});

const positiveIntegerInput = defineInputWidget<{ minimum: number }, number>()({
  match: ctx => ctx.message?.text !== undefined,
  parse: ctx => Number(ctx.message?.text),
  validate: (value, props) => valid(Math.max(value, props.minimum)),
});

positiveIntegerInput({ id: "amount", minimum: 1 });
// @ts-expect-error Custom input props are checked.
positiveIntegerInput({ id: "amount", onReceive: "amountEntered", minimum: "1" });
