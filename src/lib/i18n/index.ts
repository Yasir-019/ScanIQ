import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import hi from "./locales/hi.json";
import ru from "./locales/ru.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ur from "./locales/ur.json";

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

const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
  "zh-TW": { translation: zhTW },
  hi: { translation: hi },
  ru: { translation: ru },
  ja: { translation: ja },
  ko: { translation: ko },
  ur: { translation: ur },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
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

export function setAppLanguage(code: LanguageCode) {
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
