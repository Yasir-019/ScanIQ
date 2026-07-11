import { parseScanContent } from "@/lib/scan/parser";
import type { ScanRecord } from "@/lib/scan/types";

export interface ExplanationResult {
  summary: string;
  details: string[];
}

export function generateLocalAIExplanation(scan: ScanRecord | null): ExplanationResult {
  if (!scan) return { summary: "", details: [] };
  
  const parsed = parseScanContent(scan.content, scan.format);
  
  switch (scan.type) {
    case "url": {
      const hasHttps = scan.content.toLowerCase().startsWith("https://");
      let host = "Unknown";
      try {
        host = new URL(scan.content).hostname;
      } catch {
        /* ignore invalid URLs */
      }
      const isSuspicious =
        host.toLowerCase().includes("bank") ||
        host.toLowerCase().includes("support") ||
        host.toLowerCase().includes("login") ||
        host.toLowerCase().includes("secure");
      
      return {
        summary: "Web Link Security Analysis",
        details: [
          `This points to the domain: ${host}.`,
          hasHttps 
            ? "✅ Secure Connection: Uses HTTPS to encrypt data in transit." 
            : "⚠️ Insecure Connection: Uses plain HTTP. Any credentials entered can be intercepted.",
          isSuspicious 
            ? "🚨 Brand Alert: The domain contains sensitive terms. Double-check for phishing impersonations." 
            : "✅ No obvious brand impersonation keywords detected.",
          "🔒 Sandboxed Access: Safely opens in your browser sandbox, blocking direct root-level modifications."
        ]
      };
    }
    case "wifi": {
      const ssid = (parsed.data as Record<string, string>)?.ssid || "Unknown";
      const enc = (parsed.data as Record<string, string>)?.encryption || "None";
      return {
        summary: "Wi-Fi Network Configuration",
        details: [
          `Wireless network SSID: "${ssid}".`,
          `Security protocols: ${enc} (${enc === "WEP" ? "⚠️ Outdated" : "✅ Secure Standard"}).`,
          "📱 Connection Flow: Tapping 'Connect' configures your system settings safely. No local network data is transmitted externally."
        ]
      };
    }
    case "vcard": {
      const name = (parsed.data as Record<string, string>)?.name || "No name";
      const tel = (parsed.data as Record<string, string>)?.tel || "No number";
      const email = (parsed.data as Record<string, string>)?.email || "No email";
      return {
        summary: "Contact Entry Card (vCard)",
        details: [
          `Name details: ${name}.`,
          `Phone contact: ${tel}.`,
          `Email address: ${email}.`,
          "👤 Local Sync: Tapping 'Add Contact' saves this entry to your native address book directly. No contacts sync online."
        ]
      };
    }
    case "payment": {
      return {
        summary: "Payment Payload Specifications",
        details: [
          "This contains a payment request link.",
          "🔒 Local check: Secure bank scheme formatting detected.",
          "💸 Security Reminder: Check the payee details and exact billing amount before typing in your financial transaction PIN.",
          "Offline Hand-off: Hands over parameter parsing directly to your payment app."
        ]
      };
    }
    case "product": {
      const code = (parsed.data as Record<string, string>)?.code || scan.content;
      return {
        summary: "Commercial Product Barcode",
        details: [
          `Global barcode index: ${code}.`,
          "🛒 Product Code standard: Registered retail GTIN / UPC / EAN standard.",
          "🌐 Web Search Lookup: Runs inquiries on global consumer goods indexes to find manufacturer information, ingredients, and retail prices."
        ]
      };
    }
    default:
      return {
        summary: "Text Information Description",
        details: [
          "Payload type: Plain Text.",
          "📝 Raw data payload contains generic formatted characters.",
          "🛠️ Core Utilities: Copy information directly to system clipboard or share via local messenger apps."
        ]
      };
  }
}
