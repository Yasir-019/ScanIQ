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

  // URL
  try {
    let urlToTry = trimmed;
    if (!/^[a-z0-9-]+:/i.test(trimmed)) {
      urlToTry = "https://" + trimmed;
    }
    const url = new URL(urlToTry);
    if (["http:", "https:", "ftp:"].includes(url.protocol)) {
      // Basic domain check to avoid false positives on random text
      if (url.hostname.includes(".") || url.hostname === "localhost") {
        return { type: "url", data: { url: url.toString(), host: url.host }, display: trimmed };
      }
    }
  } catch {
    /* not a URL */
  }

  // WiFi: WIFI:T:WPA;S:MyNet;P:pass;H:false;;
  if (/^WIFI:/i.test(trimmed)) {
    const fields: Record<string, string> = {};
    const body = trimmed.replace(/^WIFI:/i, "").replace(/;;\s*$/, "");
    
    // Improved splitting that respects escaped semicolons
    let current = "";
    let escaped = false;
    const parts: string[] = [];
    
    for (let i = 0; i < body.length; i++) {
      const char = body[i];
      if (char === "\\" && !escaped) {
        escaped = true;
        current += char;
      } else if (char === ";" && !escaped) {
        parts.push(current);
        current = "";
      } else {
        escaped = false;
        current += char;
      }
    }
    if (current) parts.push(current);

    parts.forEach((pair) => {
      const [k, ...rest] = pair.split(":");
      if (k && rest.length) {
        const val = rest.join(":").replace(/\\([\\;:,])/g, "$1");
        fields[k.toUpperCase()] = val;
      }
    });
    
    return {
      type: "wifi",
      data: { ssid: fields.S || "", password: fields.P || "", encryption: fields.T || "WPA", hidden: fields.H || "false" },
      display: fields.S || trimmed,
    };
  }

  // vCard
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const lines = trimmed.split(/\r?\n/);
    const fields: Record<string, string> = {};
    
    lines.forEach(line => {
      const match = /^([^:;]+)(?:;[^:]*)?:(.+)$/i.exec(line);
      if (match) {
        const [, key, value] = match;
        const normalizedKey = key.toUpperCase();
        // Unescape vCard values
        const unescaped = value.replace(/\\([\\;:,n])/g, (m, p) => p === "n" ? "\n" : p);
        if (!fields[normalizedKey]) fields[normalizedKey] = unescaped;
      }
    });

    const name = fields.FN || fields.N || "";
    const tel = fields.TEL || "";
    const email = fields.EMAIL || "";
    
    return { 
      type: "vcard", 
      data: { name, tel, email, raw: trimmed }, 
      display: name || tel || email || "Contact" 
    };
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

export function detectContentType(content: string, format: ScanFormat): ScanContentType {
  return parseScanContent(content, format).type;
}
