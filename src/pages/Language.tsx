import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES, setAppLanguage, type LanguageCode } from "@/lib/i18n";

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const current = (i18n.resolvedLanguage || i18n.language || "en") as string;

  const isSelected = (code: LanguageCode) =>
    current === code || current.toLowerCase() === code.toLowerCase();

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
        <button
          onClick={() => navigate(-1)}
          className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back", "Back")}
        </button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          <span>{t("language.title", "Language Selection")}</span>
        </h1>
        <p className="text-xs text-muted-foreground">{t("language.subtitle")}</p>
      </div>

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
