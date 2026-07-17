import { dialogDsl } from "../app-types.js";

/** Dialogless window demonstrating a reusable stateful keyboard widget. */
export const counterCard = dialogDsl.window("counter-card", {
  text: "A reusable stateful widget:",
  keyboard: dialogDsl.widgets.counter({ id: "amount" }),
});
