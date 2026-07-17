import { t } from "@ppsh/grammy-dialog";
import { dialogDsl } from "../../app-types.js";
import { profileViewModel } from "./view-model.js";

/** Member-scoped profile editor with localized text and text/photo inputs. */
export const profileDialog = dialogDsl.dialog(
  "profile",
  ({ window, widgets }) => {
    const main = window("main", {
      viewModel: profileViewModel,
      text: ({ vm, t }) => t("profile.title", { name: vm.name }),
      media: ({ vm }) => vm.photoFileId === undefined
        ? undefined
        : widgets.photo(vm.photoFileId),
      keyboard: [[widgets.go(t("profile.edit"), "edit")]],
    });

    const edit = window("edit", {
      viewModel: profileViewModel,
      text: t("profile.prompt"),
      keyboard: [[widgets.back(t("common.back"))]],
      input: [
        widgets.textInput("saveName", { trim: true }),
        widgets.photoInput("savePhoto"),
      ],
    });

    return { windows: { main, edit } };
  },
);
