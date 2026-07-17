import type { PhotoInputValue } from "@ppsh/grammy-dialog";
import { dialogDsl } from "../../app-types.js";

/** State persisted for the profile dialog instance. */
export interface ProfileState {
  name?: string;
  photoFileId?: string;
}

/** Loads the profile view and handles profile-editing intents. */
export const profileViewModel = dialogDsl.viewModel({
  initialState: (): ProfileState => ({}),
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
