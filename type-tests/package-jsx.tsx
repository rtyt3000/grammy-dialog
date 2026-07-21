import { Text, createDialogKit } from "@ppsh/grammy-dialog";

const kit = createDialogKit();
const notice = kit.window("package-jsx", {
  view: <Text>Published JSX runtime</Text>,
});

kit.define(() => ({ notice }));
