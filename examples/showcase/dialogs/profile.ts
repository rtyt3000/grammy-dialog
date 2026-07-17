import {
  button,
  defineDialog,
  go,
  photo,
  photoInput,
  t,
  textInput,
  viewModel,
  window,
  type PhotoInputValue,
} from "@ppsh/grammy-dialog";
import type { AppContext, AppServices } from "../app-types.js";

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

const main = window("profile.main", {
  viewModel: profileVm,
  text: ({ vm, t }) => t("profile.title", { name: vm.name }),
  media: ({ vm }) => vm.photoFileId === undefined ? undefined : photo(vm.photoFileId),
  keyboard: [[button(t("profile.edit"), go("edit"))]],
});

const edit = window("profile.edit", {
  viewModel: profileVm,
  text: t("profile.prompt"),
  keyboard: [[button(t("common.back"), { kind: "back" })]],
  input: [
    textInput("saveName", { trim: true }),
    photoInput("savePhoto"),
  ],
});

export const profileDialog = defineDialog({
  id: "profile",
  windows: { main, edit },
});
