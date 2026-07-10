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
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">{t("privacy.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("privacy.subtitle")}</p>

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
