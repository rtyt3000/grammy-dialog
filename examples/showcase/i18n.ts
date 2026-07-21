import type { TranslationAdapter } from "@ppsh/grammy-dialog";

const translations: Record<string, Record<string, string>> = {
  en: {
    "profile.title": "Profile: {name}",
    "profile.edit": "Edit profile",
    "profile.prompt": "Send a new name or a profile photo.",
    "profile.nameTooShort": "The name must contain at least 2 characters.",
    "common.back": "Back",
    "poll.title": "Team poll — yes: {yes}, no: {no}",
    "notification.title": "Your report is ready.",
  },
  pl: {
    "profile.title": "Profil: {name}",
    "profile.edit": "Edytuj profil",
    "profile.prompt": "Wyślij nową nazwę lub zdjęcie profilowe.",
    "profile.nameTooShort": "Nazwa musi zawierać co najmniej 2 znaki.",
    "common.back": "Wstecz",
    "poll.title": "Ankieta zespołu — tak: {yes}, nie: {no}",
    "notification.title": "Twój raport jest gotowy.",
  },
};

/** In-memory translation adapter demonstrating the library's i18n boundary. */
export const translationAdapter: TranslationAdapter = {
  translate(locale, key, params = {}) {
    const template =
      translations[locale]?.[key] ?? translations.en?.[key] ?? key;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    );
  },
};
