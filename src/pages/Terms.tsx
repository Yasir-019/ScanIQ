import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldAlert, AlertCircle, RefreshCw } from "lucide-react";

export default function TermsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    {
      icon: FileText,
      title: "1. Acceptance of Terms",
      body: "By downloading, installing, or using the ScanIQ application, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must uninstall the application immediately.",
    },
    {
      icon: AlertCircle,
      title: "2. Permitted Use",
      body: "ScanIQ provides scanning of QR codes and barcodes, as well as the creation of QR codes. You agree to use these features strictly for lawful, personal, and informational purposes. You may not use the app to transmit or scan any malicious payload.",
    },
    {
      icon: ShieldAlert,
      title: "3. Disclaimer of Warranties",
      body: "ScanIQ is provided 'as is' without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. The developers do not guarantee the app will be error-free or uninterrupted.",
    },
    {
      icon: RefreshCw,
      title: "4. Updates and Changes",
      body: "These terms may be updated from time to time. Your continued use of the application following any changes constitutes acceptance of the new Terms of Service.",
    },
  ];

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mb-6 text-sm text-muted-foreground">Last updated: July 2026. Please read our terms carefully before using the app.</p>

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
