import type { Context } from "grammy";
import {
  createDialogKit,
  type DialogDefinition,
  type DialogFlavor,
  type IntentContext,
  type PhotoInputValue,
  type WidgetActionContext,
  type WindowDefinition,
} from "../mod.ts";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;

interface Services {
  users: { displayName(id: number): Promise<string> };
}

type BotContext = Context & DialogFlavor;
type ProfileState = { name: string; photo?: string };
type ProfileView = { title: string; photo?: string };

const builder = createDialogKit<BotContext, Services>();
const profileVm = builder.viewModel({
  initialState: (): ProfileState => ({ name: "Ada" }),
  async load({ state, services, actor }) {
    return {
      title: `${await services.users.displayName(actor.id ?? 0)}: ${state.name}`,
      photo: state.photo,
    };
  },
  intents: {
    rename({ state, value }: IntentContext<
      BotContext,
      ProfileState,
      ProfileView,
      Services,
      undefined,
      string
    >) {
      state.update(current => ({ ...current, name: value }));
    },
    savePhoto({ state, value }: IntentContext<
      BotContext,
      ProfileState,
      ProfileView,
      Services,
      undefined,
      PhotoInputValue
    >) {
      state.update(current => ({ ...current, photo: value.fileId }));
    },
    openUser({ payload }: IntentContext<
      BotContext,
      ProfileState,
      ProfileView,
      Services,
      { userId: number },
      undefined
    >) {
      payload.userId.toFixed();
    },
  },
});

const profile = builder.dialog("profile", {
  viewModel: profileVm,
  windows: ({ window, ui }) => ({
    main: window("main", {
      text: ({ vm, services }) => `${vm.title} ${services.users}`,
      keyboard: [[
        ui.button.intent("Open", profileVm.actions.openUser, {
          payload: { userId: 42 },
        }),
      ]],
      input: [
        ui.input.text("name", profileVm.actions.rename),
        ui.input.photo("photo", profileVm.actions.savePhoto),
      ],
    }),
  }),
});

type ProfileDialogState = typeof profile extends DialogDefinition<any, infer State, any, any>
  ? State
  : never;
type _DialogState = Expect<Equal<ProfileDialogState, ProfileState>>;

builder.dialog("invalid", {
  viewModel: profileVm,
  windows: ({ window, ui }) => ({
    main: window("main", {
      // @ts-expect-error Photo input cannot target a string-valued intent.
      input: [ui.input.photo("photo", profileVm.actions.rename)],
    }),
  }),
});

builder.ui.button.intent("Invalid", profileVm.actions.openUser, {
  // @ts-expect-error Intent payload is checked through its reference.
  payload: { userId: "42" },
});
// @ts-expect-error Public intent buttons require a ViewModel intent reference.
builder.ui.button.intent("Invalid", "openUser");

const notice = builder.window("notice", {
  text: ({ vm }) => JSON.stringify(vm),
});
type NoticeState = typeof notice extends WindowDefinition<any, infer State, any, any>
  ? State
  : never;
type _StaticState = Expect<Equal<NoticeState, {}>>;

const counterExtension = builder.extension(({ widget, ui }) => {
  const counter = widget.keyboard({
    state: { initial: (props: { step: number }) => props.step },
    actions: {
      increment({ state, payload }: WidgetActionContext<any, { step: number }, number, any, number>) {
        state.update(value => value + payload);
      },
    },
    render({ state, actions }) {
      return [[ui.button.raw(String(state.value), actions.increment(1))]];
    },
  });
  return { widgets: { counter } };
});

const app = builder.use(counterExtension).define(() => ({ profile, notice }));
app.widgets.counter("counter", { step: 2 });
// @ts-expect-error Custom widget props remain inferred.
app.widgets.counter("counter", {});
app.dialogs.profile;
app.windows.notice;
app.middleware({ services: {} as Services });

declare const ctx: BotContext;
ctx.dialog.start(app.dialogs.profile, { key: "primary", mode: "reuse" });
ctx.ui.show(app.windows.notice);
