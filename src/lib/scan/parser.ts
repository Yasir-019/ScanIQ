import type { ScanContentType, ScanFormat } from "./types";

const isBarcodeFormat = (format: ScanFormat) =>
  ["EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128", "CODE_39", "CODE_93", "ITF"].includes(format);

export interface ParsedScan {
  type: ScanContentType;
  data: Record<string, string>;
  display: string;
}

export function parseScanContent(content: string, format: ScanFormat): ParsedScan {
  const trimmed = content.trim();

  if (isBarcodeFormat(format) && /^\d+$/.test(trimmed)) {
    return { type: "product", data: { code: trimmed }, display: trimmed };
  }

  // UPI payment
  if (/^upi:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const payee = url.searchParams.get("pn") || url.searchParams.get("pa") || "";
    const amount = url.searchParams.get("am") || "";
    return { type: "payment", data: { scheme: "upi", payee, amount, raw: trimmed }, display: payee || "UPI Payment" };
  }

  // URL-based checks (payment services first, then generic URL)
  try {
    const url = new URL(trimmed);
    if (["http:", "https:"].includes(url.protocol)) {
      const host = url.hostname.toLowerCase();
      // Payment service detection
      if (host === "paypal.me" || host.endsWith(".paypal.me")) {
        const recipient = url.pathname.replace(/^\//, "").split("/")[0] || "";
        return { type: "payment", data: { scheme: "paypal", payee: recipient, raw: trimmed }, display: `PayPal: ${recipient}` };
      }
      if (host === "venmo.com" || host === "cash.app") {
        const recipient = url.pathname.replace(/^\//, "").split("/")[0] || "";
        return { type: "payment", data: { scheme: host.replace(".com", "").replace(".app", ""), payee: recipient, raw: trimmed }, display: `${host}: ${recipient}` };
      }
      // Generic URL
      return { type: "url", data: { url: trimmed, host: url.host }, display: trimmed };
    }
    if (url.protocol === "ftp:") {
      return { type: "url", data: { url: trimmed, host: url.host }, display: trimmed };
    }
  } catch {
    /* not a URL */
  }

  // WiFi: WIFI:T:WPA;S:MyNet;P:pass;H:false;;
  if (/^WIFI:/i.test(trimmed)) {
    const fields: Record<string, string> = {};
    const body = trimmed.replace(/^WIFI:/i, "").replace(/;;\s*$/, "");
    body.split(";").forEach((pair) => {
      const [k, ...rest] = pair.split(":");
      if (k && rest.length) fields[k.toUpperCase()] = rest.join(":");
    });
    return {
      type: "wifi",
      data: { ssid: fields.S || "", password: fields.P || "", encryption: fields.T || "WPA", hidden: fields.H || "false" },
      display: fields.S || trimmed,
    };
  }

  // vCard
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const name = /FN:(.+)/i.exec(trimmed)?.[1] || "";
    const tel = /TEL[^:]*:(.+)/i.exec(trimmed)?.[1] || "";
    const email = /EMAIL[^:]*:(.+)/i.exec(trimmed)?.[1] || "";
    return { type: "vcard", data: { name, tel, email, raw: trimmed }, display: name || tel || email || "Contact" };
  }

  // mailto / email
  if (/^mailto:/i.test(trimmed)) {
    const url = new URL(trimmed);
    return { type: "email", data: { to: url.pathname, subject: url.searchParams.get("subject") || "", body: url.searchParams.get("body") || "" }, display: url.pathname };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { type: "email", data: { to: trimmed }, display: trimmed };
  }

  // SMS / SMSTO
  if (/^smsto?:/i.test(trimmed)) {
    const [, rest] = trimmed.split(/:/, 2);
    const [number, body = ""] = (rest || "").split(":");
    return { type: "sms", data: { number, body }, display: number };
  }

  // tel:
  if (/^tel:/i.test(trimmed)) {
    return { type: "phone", data: { number: trimmed.slice(4) }, display: trimmed.slice(4) };
  }

  // geo:
  if (/^geo:/i.test(trimmed)) {
    return { type: "geo", data: { coords: trimmed.slice(4) }, display: trimmed.slice(4) };
  }

  return { type: "text", data: { text: trimmed }, display: trimmed };
}
