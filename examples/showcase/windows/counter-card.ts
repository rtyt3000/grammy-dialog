import { window } from "@ppsh/grammy-dialog";
import { counterWidget } from "../widgets/counter.js";

/** Dialogless window demonstrating a reusable stateful keyboard widget. */
export const counterCard = window("counter-card", {
  text: "A reusable stateful widget:",
  keyboard: counterWidget({ id: "amount" }),
});
