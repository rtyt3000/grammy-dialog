import type { Context } from "grammy";
import {
  Button,
  bind,
  createDialogKit,
  defineWidget,
  intent,
  Keyboard,
  Photo,
  Row,
  Text,
  Window,
  type DialogDefinition,
  type DialogFlavor,
  type IntentContext,
  type PhotoInputValue,
  type WidgetActionContext,
  type WindowDefinition,
} from "../mod.ts";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
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
    rename({
      state,
      value,
    }: IntentContext<
      BotContext,
      ProfileState,
      ProfileView,
      Services,
      undefined,
      string
    >) {
      state.update((current) => ({ ...current, name: value }));
    },
    savePhoto({
      state,
      value,
    }: IntentContext<
      BotContext,
      ProfileState,
      ProfileView,
      Services,
      undefined,
      PhotoInputValue
    >) {
      state.update((current) => ({ ...current, photo: value.fileId }));
    },
    openUser({
      payload,
    }: IntentContext<
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
  windows: ({ window }) => ({
    main: window("main", {
      view: ({ vm, services }) => (
        <Window>
          <Text>
            {vm.title} {String(services.users)}
          </Text>
          {vm.photo === undefined ? null : <Photo source={vm.photo} />}
          <Keyboard>
            <Row>
              <Button
                action={intent(profileVm.actions.openUser, { userId: 42 })}
              >
                Open
              </Button>
            </Row>
          </Keyboard>
        </Window>
      ),
      input: [
        bind.text("name", profileVm.actions.rename),
        bind.photo("photo", profileVm.actions.savePhoto),
      ],
    }),
  }),
});

type ProfileDialogState =
  typeof profile extends DialogDefinition<any, infer State, any, any>
    ? State
    : never;
type _DialogState = Expect<Equal<ProfileDialogState, ProfileState>>;

builder.dialog("invalid", {
  viewModel: profileVm,
  windows: ({ window }) => ({
    main: window("main", {
      // @ts-expect-error Photo input cannot target a string-valued intent.
      input: [bind.photo("photo", profileVm.actions.rename)],
    }),
  }),
});

// @ts-expect-error Intent payload is checked through its reference.
profileVm.actions.openUser({ userId: "42" });

const notice = builder.window("notice", {
  view: ({ vm }) => <Text>{JSON.stringify(vm)}</Text>,
});
type NoticeState =
  typeof notice extends WindowDefinition<any, infer State, any, any>
    ? State
    : never;
type _StaticState = Expect<Equal<NoticeState, {}>>;

const Counter = defineWidget<{ step: number }, number>()({
  state: { initial: (props) => props.step },
  actions: {
    increment({
      state,
      payload,
    }: WidgetActionContext<any, { step: number }, number, any, number>) {
      state.update((value) => value + payload);
    },
  },
  render({ state, actions }) {
    return (
      <Row>
        <Button action={actions.increment(1)}>{state.value}</Button>
      </Row>
    );
  },
});

const app = builder.define(() => ({ profile, notice }));
<Keyboard>
  <Counter id="counter" step={2} />
</Keyboard>;
// @ts-expect-error Custom widget props remain inferred.
Counter({ id: "counter" });
app.dialogs.profile;
app.windows.notice;
app.middleware({ services: {} as Services });

declare const ctx: BotContext;
ctx.dialog.start(app.dialogs.profile, { key: "primary", mode: "reuse" });
ctx.ui.show(app.windows.notice);
