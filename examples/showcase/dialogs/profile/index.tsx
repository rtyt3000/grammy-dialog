import {
  Button,
  Input,
  Keyboard,
  Photo,
  PhotoInput,
  Row,
  Text,
  TextInput,
  Window,
  back,
  go,
  invalid,
  valid,
} from "@ppsh/grammy-dialog";
import { dialogDsl } from "../../app-types.js";
import { profileViewModel } from "./view-model.js";

/** Member-scoped profile editor with localized text and text/photo inputs. */
export const profileDialog = dialogDsl.dialog("profile", {
  viewModel: profileViewModel,
  windows: ({ window }) => {
    const main = window("main", {
      view: async ({ vm, t }) => (
        <Window>
          <Text>{await t("profile.title", { name: vm.name })}</Text>
          {vm.photoFileId === undefined ? null : (
            <Photo source={vm.photoFileId} />
          )}
          <Keyboard>
            <Row>
              <Button action={go("edit")}>{await t("profile.edit")}</Button>
            </Row>
          </Keyboard>
        </Window>
      ),
    });

    const edit = window("edit", {
      view: async ({ t }) => (
        <Window>
          <Text>{await t("profile.prompt")}</Text>
          <Keyboard>
            <Row>
              <Button action={back()}>{await t("common.back")}</Button>
            </Row>
          </Keyboard>
          <Input>
            <TextInput
              id="name"
              receive={profileViewModel.actions.saveName}
              trim
              validate={(value) =>
                value.length >= 2
                  ? valid(value)
                  : invalid(({ t }) => t("profile.nameTooShort"))
              }
            />
            <PhotoInput
              id="photo"
              receive={profileViewModel.actions.savePhoto}
            />
          </Input>
        </Window>
      ),
    });

    return { main, edit };
  },
});
