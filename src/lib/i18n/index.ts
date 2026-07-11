import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";

export type LanguageCode =
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "hi"
  | "ru"
  | "ja"
  | "ko"
  | "ur";

export interface LanguageMeta {
  code: LanguageCode;
  /** English label shown to all users for findability */
  englishLabel: string;
  /** Native script label */
  nativeLabel: string;
  dir: "ltr" | "rtl";
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "en", englishLabel: "English", nativeLabel: "English", dir: "ltr" },
  { code: "zh-CN", englishLabel: "Chinese (Simplified)", nativeLabel: "简体中文", dir: "ltr" },
  { code: "zh-TW", englishLabel: "Chinese (Traditional)", nativeLabel: "繁體中文", dir: "ltr" },
  { code: "hi", englishLabel: "Hindi", nativeLabel: "हिन्दी", dir: "ltr" },
  { code: "ru", englishLabel: "Russian", nativeLabel: "Русский", dir: "ltr" },
  { code: "ja", englishLabel: "Japanese", nativeLabel: "日本語", dir: "ltr" },
  { code: "ko", englishLabel: "Korean", nativeLabel: "한국어", dir: "ltr" },
  { code: "ur", englishLabel: "Urdu", nativeLabel: "اردو", dir: "rtl" },
];

const STORAGE_KEY = "scaniq-language";

const localeLoaders: Record<LanguageCode, () => Promise<{ default: unknown }>> = {
  en: () => Promise.resolve({ default: en }),
  "zh-CN": () => import("./locales/zh-CN.json"),
  "zh-TW": () => import("./locales/zh-TW.json"),
  hi: () => import("./locales/hi.json"),
  ru: () => import("./locales/ru.json"),
  ja: () => import("./locales/ja.json"),
  ko: () => import("./locales/ko.json"),
  ur: () => import("./locales/ur.json"),
};

export async function loadLanguageResources(code: LanguageCode) {
  if (i18n.hasResourceBundle(code, "translation")) return;
  try {
    const loader = localeLoaders[code];
    if (loader) {
      const module = await loader();
      i18n.addResourceBundle(code, "translation", module.default, true, true);
    }
  } catch (e) {
    console.error("[i18n] Failed to load language resource:", code, e);
  }
}

// Read initial config from localStorage or fallback to system locale
let initialLang: LanguageCode = "en";
try {
  const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
    initialLang = stored;
  } else {
    const navLang = navigator.language;
    const matched = SUPPORTED_LANGUAGES.find((l) => navLang.startsWith(l.code))?.code;
    if (matched) initialLang = matched;
  }
} catch {
  /* ignore */
}

const resources = {
  en: { translation: en },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    lng: initialLang,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    load: "currentOnly",
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

// Trigger dynamic loading of locale if not English
if (initialLang !== "en") {
  loadLanguageResources(initialLang).then(() => {
    i18n.changeLanguage(initialLang);
  }).catch(() => {});
}

export async function setAppLanguage(code: LanguageCode) {
  await loadLanguageResources(code);
  i18n.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  applyDocumentDirection(code);
}

export function applyDocumentDirection(code: string) {
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === code) ??
    SUPPORTED_LANGUAGES.find((l) => code.startsWith(l.code));
  const dir = meta?.dir ?? "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", meta?.code ?? "en");
}

// Apply on initial load
applyDocumentDirection(i18n.language || "en");

export default i18n;
