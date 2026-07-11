import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SafetyResult } from "@/lib/url-safety";

export function SafetyWarningCard({ safety }: { safety: SafetyResult }) {
  const { t } = useTranslation();
  if (safety.level === "safe") return null;

  const isMalicious = safety.level === "malicious";

  return (
    <div
      className={`rounded-2xl border p-4 text-left ${
        isMalicious
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-warning/30 bg-warning/5 text-warning"
      }`}
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {isMalicious ? t("safety.dangerTitle") : t("safety.warningTitle")}
      </div>
      <ul className="list-inside list-disc space-y-1 text-xs opacity-90">
        {safety.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
