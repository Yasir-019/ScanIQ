import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Cpu, ShieldCheck, Users, Scale } from "lucide-react";
import { APP_NAME, APP_TAGLINE, APP_VERSION, APP_LICENSE, APP_REPO_URL } from "@/lib/app-meta";

export default function AboutScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    {
      icon: Info,
      title: "What this is",
      body: `${APP_NAME} is a free, open-source QR and barcode OSINT toolkit. It treats every scanned code as untrusted input: instead of instantly acting on a payload, it decomposes it, analyzes it, and reports what it found.`,
    },
    {
      icon: Users,
      title: "Who it's for",
      body: "Privacy-conscious users, cybersecurity students, OSINT researchers, and security professionals who need to inspect a code before trusting it — in the field, on a phone, without a backend.",
    },
    {
      icon: Cpu,
      title: "How analysis works",
      body: "A registry of pure, offline analyzers inspects transport, identity, obfuscation, infrastructure, payload, credential, and privacy signals. Each finding carries evidence and a rationale, and contributes a documented weight to the risk score.",
    },
    {
      icon: ShieldCheck,
      title: "Privacy model",
      body: "No accounts, no cloud, no analytics by default. Scans and case history stay in local IndexedDB. Any online enrichment is opt-in and discloses exactly what would leave your device.",
    },
    {
      icon: Scale,
      title: "Open source",
      body: `${APP_LICENSE} licensed and auditable. Findings and scoring logic live in the repository so anyone can verify, challenge, or extend them: ${APP_REPO_URL}`,
    },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
        <button onClick={() => navigate(-1)} className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back", "Back")}
        </button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <span>About {APP_NAME}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          Version {APP_VERSION} · {APP_TAGLINE}
        </p>
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
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
