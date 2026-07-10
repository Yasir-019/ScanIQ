import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES, setAppLanguage, type LanguageCode } from "@/lib/i18n";

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en") as string;

  const isSelected = (code: LanguageCode) =>
    current === code || current.toLowerCase() === code.toLowerCase();

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to="/profile"
          aria-label={t("common.back")}
          className="-ml-2 rounded-full p-2 text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("language.title")}</h1>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{t("language.subtitle")}</p>

      <ul className="space-y-2">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const selected = isSelected(lang.code);
          return (
            <li key={lang.code}>
              <button
                onClick={() => setAppLanguage(lang.code)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-base font-semibold"
                    dir={lang.dir}
                    lang={lang.code}
                  >
                    {lang.nativeLabel}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {lang.englishLabel}
                  </div>
                </div>
                {selected && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                    <Check className="h-3.5 w-3.5" />
                    {t("language.selected")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
