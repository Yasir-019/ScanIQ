import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_SHARE_URL, APP_TAGLINE } from "@/lib/app-meta";
import { downloadBlob, shareImageBlob } from "@/lib/share";

export default function ShareQRScreen() {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(APP_SHARE_URL, {
      margin: 2,
      width: 640,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(() => undefined);
  }, []);

  const getBlob = async () => (await fetch(dataUrl)).blob();

  const onDownload = async () => {
    if (!dataUrl) return;
    const blob = await getBlob();
    downloadBlob(blob, `${APP_NAME}-qr.png`);
  };

  const onShare = async () => {
    if (!dataUrl) return;
    const blob = await getBlob();
    await shareImageBlob(blob, `${APP_NAME}-qr.png`, `${APP_NAME} — share`);
  };

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
          <Link to="/profile" aria-label={t("common.back")}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t("shareQR.title")}</h1>
      </div>

      <div className="mb-5 rounded-3xl border border-border bg-card p-5 text-center shadow-card">
        <p className="mb-4 text-sm text-muted-foreground">
          {t("shareQR.subtitle")}
        </p>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`${APP_NAME} download QR code`}
            className="mx-auto h-64 w-64 rounded-2xl bg-white p-3"
          />
        ) : (
          <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        )}
        <p className="mt-4 text-base font-semibold">{APP_NAME}</p>
        <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
        <p className="mt-3 break-all rounded-xl bg-secondary/60 px-3 py-2 text-xs text-foreground/80">
          {APP_SHARE_URL}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onDownload} disabled={!dataUrl} size="lg">
          <Download className="mr-2 h-4 w-4" /> {t("shareQR.downloadButton")}
        </Button>
        <Button onClick={onShare} disabled={!dataUrl} variant="secondary" size="lg">
          <Share2 className="mr-2 h-4 w-4" /> {t("shareQR.shareButton")}
        </Button>
      </div>
    </div>
  );
}
