import { dialogDsl } from "../../app-types.js";
import { profileViewModel } from "./view-model.js";

/** Member-scoped profile editor with localized text and text/photo inputs. */
export const profileDialog = dialogDsl.dialog(
  "profile",
  {
    viewModel: profileViewModel,
    windows: ({ window, ui }) => {
      const main = window("main", {
        text: ({ vm, t }) => t("profile.title", { name: vm.name }),
        media: ({ vm }) => vm.photoFileId === undefined
          ? undefined
          : ui.media.photo(vm.photoFileId),
        keyboard: [[ui.button.go(ui.text.key("profile.edit"), "edit")]],
      });

      const edit = window("edit", {
        text: ui.text.key("profile.prompt"),
        keyboard: [[ui.button.back(ui.text.key("common.back"))]],
        input: [
          ui.input.text("name", profileViewModel.actions.saveName, { trim: true }),
          ui.input.photo("photo", profileViewModel.actions.savePhoto),
        ],
      });

      return { main, edit };
    },
  },
);
