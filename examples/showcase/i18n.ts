import type { TranslationAdapter } from "@ppsh/grammy-dialog";

const translations: Record<string, Record<string, string>> = {
  en: {
    "profile.title": "Profile: {name}",
    "profile.edit": "Edit profile",
    "profile.prompt": "Send a new name or a profile photo.",
    "common.back": "Back",
    "poll.title": "Team poll — yes: {yes}, no: {no}",
    "notification.title": "Your report is ready.",
  },
  pl: {
    "profile.title": "Profil: {name}",
    "profile.edit": "Edytuj profil",
    "profile.prompt": "Wyślij nową nazwę lub zdjęcie profilowe.",
    "common.back": "Wstecz",
    "poll.title": "Ankieta zespołu — tak: {yes}, nie: {no}",
    "notification.title": "Twój raport jest gotowy.",
  },
};

export const translationAdapter: TranslationAdapter = {
  translate(locale, key, params = {}) {
    const template = translations[locale]?.[key] ?? translations.en?.[key] ?? key;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    );
  },
};
