import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "./locales/fr.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGUAGES = ["fr", "ar"];
const RTL_LANGUAGES = ["ar"];
const STORAGE_KEY = "wasel_lang";

export function applyDirection(lang) {
  document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

function detectLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage indisponible (navigation privée) : retombe sur le français.
  }
  return "fr";
}

const initialLanguage = detectLanguage();

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: "fr",
  interpolation: {
    // React échappe déjà le contenu affiché (jamais dangerouslySetInnerHTML
    // pour ces chaînes) : pas de double échappement par i18next.
    escapeValue: false,
  },
});

applyDirection(initialLanguage);

i18n.on("languageChanged", (lang) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // localStorage indisponible : la préférence ne sera pas persistée.
  }
  applyDirection(lang);
});

export default i18n;
