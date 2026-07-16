import { Bot, type Api, type Context } from "grammy";
import {
  access,
  button,
  defineDialog,
  dialogs,
  go,
  MemoryStorageAdapter,
  photo,
  photoInput,
  scopes,
  t,
  textInput,
  viewModel,
  window,
  type DialogFlavor,
  type DialogPlugin,
  type DialogStorageRecord,
  type PhotoInputValue,
  type TranslationAdapter,
} from "@ppsh/grammy-dialog";
import { defineKeyboardWidget } from "@ppsh/grammy-dialog/widgets";

interface AppServices {
  profiles: {
    displayName(userId: number): Promise<string>;
  };
}

type AppContext = Context & DialogFlavor;

const translations: Record<string, Record<string, string>> = {
  en: {
    "profile.title": "Profile: {name}",
    "profile.edit": "Edit profile",
    "profile.prompt": "Send a new name or a profile photo.",
    "profile.saved": "Profile updated: {name}",
    "common.back": "Back",
    "poll.title": "Team poll — yes: {yes}, no: {no}",
    "notification.title": "Your report is ready.",
  },
  pl: {
    "profile.title": "Profil: {name}",
    "profile.edit": "Edytuj profil",
    "profile.prompt": "Wyślij nową nazwę lub zdjęcie profilowe.",
    "profile.saved": "Profil zaktualizowany: {name}",
    "common.back": "Wstecz",
    "poll.title": "Ankieta zespołu — tak: {yes}, nie: {no}",
    "notification.title": "Twój raport jest gotowy.",
  },
};

const translationAdapter: TranslationAdapter = {
  translate(locale, key, params = {}) {
    const template = translations[locale]?.[key] ?? translations.en?.[key] ?? key;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    );
  },
};

const services: AppServices = {
  profiles: {
    async displayName(userId) {
      return `user-${userId}`;
    },
  },
};

interface ProfileState {
  name?: string;
  photoFileId?: string;
}

const profileVm = viewModel<
  ProfileState,
  { name: string; photoFileId?: string },
  AppContext,
  AppServices
>({
  initialState: {},
  async load({ actor, services, state }) {
    return {
      name: state.name ?? await services.profiles.displayName(actor.id ?? 0),
      photoFileId: state.photoFileId,
    };
  },
  intents: {
    saveName({ state, value, navigation }) {
      state.update(current => ({ ...current, name: String(value) }));
      navigation.back();
    },
    savePhoto({ state, value, navigation }) {
      const received = value as PhotoInputValue;
      state.update(current => ({ ...current, photoFileId: received.fileId }));
      navigation.back();
    },
  },
});

const profileMain = window("profile.main", {
  viewModel: profileVm,
  text: ({ vm, t }) => t("profile.title", { name: vm.name }),
  media: ({ vm }) => vm.photoFileId === undefined ? undefined : photo(vm.photoFileId),
  keyboard: [[button(t("profile.edit"), go("edit"))]],
});

const profileEdit = window("profile.edit", {
  viewModel: profileVm,
  text: t("profile.prompt"),
  keyboard: [[button(t("common.back"), { kind: "back" })]],
  input: [
    textInput("profile-name", { trim: true, onReceive: "saveName" }),
    photoInput("profile-photo", { onReceive: "savePhoto" }),
  ],
});

const profileDialog = defineDialog({
  id: "profile",
  initial: "main",
  windows: { main: profileMain, edit: profileEdit },
  scope: scopes.member<AppContext>(),
  access: access.owner<AppContext>(),
});

const pollVm = viewModel({
  initialState: { yes: 0, no: 0 },
  load: ({ state }) => state,
  intents: {
    yes({ state }) {
      state.update(current => ({ ...current, yes: current.yes + 1 }));
    },
    no({ state }) {
      state.update(current => ({ ...current, no: current.no + 1 }));
    },
  },
});

const pollWindow = window("team-poll.main", {
  viewModel: pollVm,
  text: ({ vm, t }) => t("poll.title", vm),
  keyboard: [[button("👍", "yes"), button("👎", "no")]],
});

const teamPollDialog = defineDialog({
  id: "team-poll",
  initial: "main",
  windows: { main: pollWindow },
  scope: scopes.chat<AppContext>(),
  access: access.everyone<AppContext>(),
});

const counterWidget = defineKeyboardWidget<{ step: number }, number>()({
  state: {
    version: 1,
    initial: () => 0,
  },
  actions: {
    decrement({ state, props }) {
      state.update(value => value - props.step);
    },
    increment({ state, props }) {
      state.update(value => value + props.step);
    },
  },
  render({ state, actions }) {
    return [[
      button("−", actions.decrement()),
      button(String(state.value), actions.increment()),
      button("+", actions.increment()),
    ]];
  },
});

const counterVm = viewModel({
  initialState: {},
  load: () => ({}),
  intents: {},
});

const counterCard = window("counter-card", {
  viewModel: counterVm,
  text: "A reusable stateful widget:",
  keyboard: counterWidget({ id: "amount", step: 1 }),
});

const notificationWindow = window("report-ready", {
  viewModel: counterVm,
  text: t("notification.title"),
  media: photo("https://picsum.photos/seed/grammy-dialog/800/400"),
});

export function createShowcaseBot(token: string) {
  const bot = new Bot<AppContext>(token);
  const plugin: DialogPlugin<AppContext, AppServices> = dialogs<AppContext, AppServices>({
    list: [profileDialog, teamPollDialog, counterCard, notificationWindow],
    storage: new MemoryStorageAdapter<DialogStorageRecord>(),
    services,
    i18n: {
      adapter: translationAdapter,
      locale: {
        resolve: ctx => ctx.from?.language_code === "pl" ? "pl" : "en",
      },
    },
  });

  bot.use(plugin);
  bot.command("profile", ctx => ctx.dialog.start("profile"));
  bot.command("poll", ctx => ctx.dialog.start("team-poll"));
  bot.command("counter", ctx => ctx.ui.show("counter-card"));
  bot.command("report", ctx => ctx.ui.show("report-ready"));

  return { bot, dialogs: plugin };
}

export async function sendReportFromBackground(
  plugin: DialogPlugin<AppContext, AppServices>,
  api: Api,
  chatId: number,
  userId: number,
): Promise<void> {
  await plugin.runtime.show("report-ready", {
    api,
    chatId,
    actorId: userId,
    locale: "en",
  });
}
