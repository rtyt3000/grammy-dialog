import type { IntentContext, PhotoInputValue } from "@ppsh/grammy-dialog";
import {
  dialogDsl,
  type AppContext,
  type AppServices,
} from "../../app-types.js";

/** State persisted for the profile dialog instance. */
export interface ProfileState {
  name?: string;
  photoFileId?: string;
}

export interface ProfileView {
  name: string;
  photoFileId?: string;
}

/** Loads the profile view and handles profile-editing intents. */
export const profileViewModel = dialogDsl.viewModel({
  initialState: (): ProfileState => ({}),
  async load({ actor, services, state }) {
    return {
      name: state.name ?? (await services.profiles.displayName(actor.id ?? 0)),
      photoFileId: state.photoFileId,
    };
  },
  intents: {
    saveName({
      state,
      value,
      navigation,
    }: IntentContext<
      AppContext,
      ProfileState,
      ProfileView,
      AppServices,
      undefined,
      string
    >) {
      state.update((current) => ({ ...current, name: value }));
      navigation.back();
    },
    savePhoto({
      state,
      value,
      navigation,
    }: IntentContext<
      AppContext,
      ProfileState,
      ProfileView,
      AppServices,
      undefined,
      PhotoInputValue
    >) {
      state.update((current) => ({ ...current, photoFileId: value.fileId }));
      navigation.back();
    },
  },
});
