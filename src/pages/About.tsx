import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Cpu, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";

export default function AboutScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    {
      icon: Info,
      title: "App Description",
      body: `${APP_NAME} is a fast, smart QR and Barcode utility designed for daily tasks. It features zero advertising, a clean local-first storage architecture, and automated smart actions to streamline workflows.`,
    },
    {
      icon: Cpu,
      title: "Core Technology",
      body: "Built on high-performance progressive web standards with robust browser scanning utilities, ScanIQ leverages local multi-format recognition engines to scan codes instantly.",
    },
    {
      icon: ShieldCheck,
      title: "Privacy Commitment",
      body: "Your safety and privacy are our top priorities. ScanIQ does not gather analytics, track your location, or upload your scan history. All operations occur directly on your device.",
    },
  ];

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="mb-1 text-2xl font-bold tracking-tight">About {APP_NAME}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Version 1.0.0 · {APP_TAGLINE}</p>

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
