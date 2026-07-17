import { window } from "@ppsh/grammy-dialog";
import { counterWidget } from "../widgets/counter.js";

export const counterCard = window("counter-card", {
  text: "A reusable stateful widget:",
  keyboard: counterWidget({ id: "amount" }),
});
