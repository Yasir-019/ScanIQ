import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Share2, Link as LinkIcon, FileText, Wifi, User, Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

type GenType = "url" | "text" | "wifi" | "vcard" | "email" | "sms" | "phone";

const types: { value: GenType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "url", label: "URL", icon: LinkIcon },
  { value: "text", label: "Text", icon: FileText },
  { value: "wifi", label: "Wi-Fi", icon: Wifi },
  { value: "vcard", label: "Contact", icon: User },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "phone", label: "Phone", icon: Phone },
];

const escapeWifi = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/:/g, "\\:").replace(/,/g, "\\,");
const escapeVCard = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function buildPayload(type: GenType, f: Record<string, string>): string {
  switch (type) {
    case "url":
      return f.url || "";
    case "text":
      return f.text || "";
    case "wifi":
      return `WIFI:T:${f.encryption || "WPA"};S:${escapeWifi(f.ssid || "")};P:${escapeWifi(f.password || "")};H:${f.hidden === "true" ? "true" : "false"};;`;
    case "vcard":
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${escapeVCard(f.name || "")}\nTEL:${escapeVCard(f.tel || "")}\nEMAIL:${escapeVCard(f.email || "")}\nEND:VCARD`;
    case "email":
      return `mailto:${f.to || ""}${f.subject ? `?subject=${encodeURIComponent(f.subject)}` : ""}`;
    case "sms":
      return `SMSTO:${f.number || ""}:${f.body || ""}`;
    case "phone":
      return `tel:${f.number || ""}`;
  }
}

export default function GenerateScreen() {
  const [type, setType] = useState<GenType>("url");
  const [fields, setFields] = useState<Record<string, string>>({ url: "https://lovable.dev" });
  const [dataUrl, setDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [payload]);

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

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-${Date.now()}.png`;
    a.click();
    toast.success("QR code downloaded");
  };

  const share = async () => {
    if (!dataUrl) return;
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
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Generate</h1>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {types.map(({ value, label, icon: Icon }) => (
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
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-3xl border border-border bg-card p-4 shadow-card">
        {dataUrl ? (
          <img 
            src={dataUrl} 
            alt="QR preview" 
            className="mx-auto h-56 w-56 rounded-xl bg-white p-2" 
            width={224} 
            height={224}
            loading="lazy"
          />
        ) : (
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            Fill in fields below
          </div>
        )}
      </div>

      <div className="space-y-3">
        {type === "url" && <Field label="URL" value={fields.url || ""} onChange={(v) => update("url", v)} placeholder="https://example.com" />}
        {type === "text" && (
          <div className="space-y-1.5">
            <Label>Text</Label>
            <Textarea value={fields.text || ""} onChange={(e) => update("text", e.target.value)} rows={4} />
          </div>
        )}
        {type === "wifi" && (
          <>
            <Field label="Network name (SSID)" value={fields.ssid || ""} onChange={(v) => update("ssid", v)} />
            <Field label="Password" value={fields.password || ""} onChange={(v) => update("password", v)} type="password" />
            <div className="space-y-1.5">
              <Label>Encryption</Label>
              <Select value={fields.encryption || "WPA"} onValueChange={(v) => update("encryption", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WPA">WPA / WPA2</SelectItem>
                  <SelectItem value="WEP">WEP</SelectItem>
                  <SelectItem value="nopass">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {type === "vcard" && (
          <>
            <Field label="Full name" value={fields.name || ""} onChange={(v) => update("name", v)} />
            <Field label="Phone" value={fields.tel || ""} onChange={(v) => update("tel", v)} />
            <Field label="Email" value={fields.email || ""} onChange={(v) => update("email", v)} type="email" />
          </>
        )}
        {type === "email" && (
          <>
            <Field label="To" value={fields.to || ""} onChange={(v) => update("to", v)} type="email" />
            <Field label="Subject (optional)" value={fields.subject || ""} onChange={(v) => update("subject", v)} />
          </>
        )}
        {type === "sms" && (
          <>
            <Field label="Number" value={fields.number || ""} onChange={(v) => update("number", v)} />
            <Field label="Message" value={fields.body || ""} onChange={(v) => update("body", v)} />
          </>
        )}
        {type === "phone" && <Field label="Phone number" value={fields.number || ""} onChange={(v) => update("number", v)} />}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button onClick={download} disabled={!dataUrl} size="lg">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button onClick={share} disabled={!dataUrl} variant="secondary" size="lg">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </div>

      <canvas ref={canvasRef} hidden />
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
