import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Share2, Link as LinkIcon, FileText, Wifi, User, Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { telemetry } from "@/lib/telemetry";

type GenType = "url" | "text" | "wifi" | "vcard" | "email" | "sms" | "phone";

const typeConfig: { value: GenType; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "url", icon: LinkIcon },
  { value: "text", icon: FileText },
  { value: "wifi", icon: Wifi },
  { value: "vcard", icon: User },
  { value: "email", icon: Mail },
  { value: "sms", icon: MessageSquare },
  { value: "phone", icon: Phone },
];

function buildPayload(type: GenType, f: Record<string, string>): string {
  switch (type) {
    case "url":
      return f.url || "";
    case "text":
      return f.text || "";
    case "wifi":
      return `WIFI:T:${f.encryption || "WPA"};S:${f.ssid || ""};P:${f.password || ""};H:${f.hidden === "true" ? "true" : "false"};;`;
    case "vcard":
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${f.name || ""}\nTEL:${f.tel || ""}\nEMAIL:${f.email || ""}\nEND:VCARD`;
    case "email":
      return `mailto:${f.to || ""}${f.subject ? `?subject=${encodeURIComponent(f.subject)}` : ""}`;
    case "sms":
      return `SMSTO:${f.number || ""}:${f.body || ""}`;
    case "phone":
      return `tel:${f.number || ""}`;
  }
}

export default function GenerateScreen() {
  const { t } = useTranslation();
  const isPro = useSettings((s) => s.isPro);
  const [type, setType] = useState<GenType>("url");
  const [fields, setFields] = useState<Record<string, string>>({ url: "https://" });
  const [dataUrl, setDataUrl] = useState<string>("");
  const [fgColor, setFgColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");

  const payload = useMemo(() => buildPayload(type, fields), [type, fields]);

  useEffect(() => {
    if (!payload) {
      setDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(payload, {
      margin: 2,
      width: 512,
      color: {
        dark: isPro ? fgColor : "#0f172a",
        light: isPro ? bgColor : "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [payload, isPro, fgColor, bgColor]);

  const onTypeChange = (v: GenType) => {
    setType(v);
    const defaults: Record<GenType, Record<string, string>> = {
      url: { url: "https://" },
      text: { text: "" },
      wifi: { ssid: "", password: "", encryption: "WPA", hidden: "false" },
      vcard: { name: "", tel: "", email: "" },
      email: { to: "", subject: "" },
      sms: { number: "", body: "" },
      phone: { number: "" },
    };
    setFields(defaults[v]);
  };

  const update = (k: string, v: string) => setFields((p) => ({ ...p, [k]: v }));

  const saveGeneratedToDB = async () => {
    try {
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        type,
        payload,
        createdAt: Date.now(),
        style: isPro ? { fg: fgColor, bg: bgColor } : undefined,
      };
      await db.generated.put(record);
      telemetry.trackEvent("qr_generated", { type });
    } catch (e) {
      console.error("Failed to save generated QR code:", e);
    }
  };

  const download = () => {
    if (!dataUrl) return;
    saveGeneratedToDB();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-${Date.now()}.png`;
    a.click();
    toast.success(t("generate.downloaded"));
  };

  const share = async () => {
    if (!dataUrl) return;
    saveGeneratedToDB();
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "qrcode.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "QR Code" });
        return;
      }
    } catch {
      /* fallthrough */
    }
    download();
  };

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t("generate.title")}</h1>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {typeConfig.map(({ value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onTypeChange(value)}
            className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs transition ${
              type === value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="h-5 w-5" />
            {t(`generate.types.${value}`)}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-3xl border border-border bg-card p-4 shadow-card">
        {dataUrl ? (
          <img src={dataUrl} alt="QR preview" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
        ) : (
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            {t("generate.placeholder")}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {type === "url" && <Field label={t("generate.fields.url")} value={fields.url || ""} onChange={(v) => update("url", v)} placeholder="https://example.com" />}
        {type === "text" && (
          <div className="space-y-1.5">
            <Label>{t("generate.fields.text")}</Label>
            <Textarea value={fields.text || ""} onChange={(e) => update("text", e.target.value)} rows={4} />
          </div>
        )}
        {type === "wifi" && (
          <>
            <Field label={t("generate.fields.ssid")} value={fields.ssid || ""} onChange={(v) => update("ssid", v)} />
            <Field label={t("generate.fields.password")} value={fields.password || ""} onChange={(v) => update("password", v)} type="password" />
            <div className="space-y-1.5">
              <Label>{t("generate.fields.encryption")}</Label>
              <Select value={fields.encryption || "WPA"} onValueChange={(v) => update("encryption", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WPA">{t("generate.encryption.wpa")}</SelectItem>
                  <SelectItem value="WEP">{t("generate.encryption.wep")}</SelectItem>
                  <SelectItem value="nopass">{t("generate.encryption.none")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {type === "vcard" && (
          <>
            <Field label={t("generate.fields.name")} value={fields.name || ""} onChange={(v) => update("name", v)} />
            <Field label={t("generate.fields.phone")} value={fields.tel || ""} onChange={(v) => update("tel", v)} />
            <Field label={t("generate.fields.email")} value={fields.email || ""} onChange={(v) => update("email", v)} type="email" />
          </>
        )}
        {type === "email" && (
          <>
            <Field label={t("generate.fields.to")} value={fields.to || ""} onChange={(v) => update("to", v)} type="email" />
            <Field label={t("generate.fields.subject")} value={fields.subject || ""} onChange={(v) => update("subject", v)} />
          </>
        )}
        {type === "sms" && (
          <>
            <Field label={t("generate.fields.number")} value={fields.number || ""} onChange={(v) => update("number", v)} />
            <Field label={t("generate.fields.message")} value={fields.body || ""} onChange={(v) => update("body", v)} />
          </>
        )}
        {type === "phone" && <Field label={t("generate.fields.phoneNumber")} value={fields.number || ""} onChange={(v) => update("number", v)} />}

        {isPro && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="text-sm font-semibold text-primary">Custom QR Colors (Pro Unlocked)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Foreground Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  />
                  <span className="text-xs font-mono">{fgColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  />
                  <span className="text-xs font-mono">{bgColor}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button onClick={download} disabled={!dataUrl} size="lg">
            <Download className="mr-2 h-4 w-4" /> {t("common.download")}
          </Button>
          <Button onClick={share} disabled={!dataUrl} variant="secondary" size="lg">
            <Share2 className="mr-2 h-4 w-4" /> {t("common.share")}
          </Button>
        </div>
      </div>


    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} />
    </div>
  );
}
