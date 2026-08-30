import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Database, Camera, Trash2 } from "lucide-react";

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    { icon: Database, title: t("privacy.localDataTitle"), body: t("privacy.localDataBody") },
    { icon: Camera, title: t("privacy.cameraTitle"), body: t("privacy.cameraBody") },
    { icon: Shield, title: t("privacy.noTrackingTitle"), body: t("privacy.noTrackingBody") },
    { icon: Trash2, title: t("privacy.clearDataTitle"), body: t("privacy.clearDataBody") },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
        <button onClick={() => navigate(-1)} className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back", "Back")}
        </button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span>{t("privacy.title", "Privacy & Data Policy")}</span>
        </h1>
        <p className="text-xs text-muted-foreground">{t("privacy.subtitle")}</p>
      </div>

      <div className="space-y-4">
        {sections.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
