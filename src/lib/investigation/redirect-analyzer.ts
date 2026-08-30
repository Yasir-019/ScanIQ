import type { RedirectChain, RedirectHop } from "@/lib/scan/types";
import type { InvestigationFinding, NormalizedUrlResult } from "./types";

export function analyzeRedirectPatternsLocally(
  urlResult: NormalizedUrlResult,
): {
  chain?: RedirectChain;
  findings: InvestigationFinding[];
} {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];

  if (!urlResult.isValid || !urlResult.parsedUrl) {
    return { findings };
  }

  const { summary, suspiciousQueryParams, original } = urlResult;
  const redirectParams = suspiciousQueryParams.filter((p) =>
    p.reason.includes("redirect") || p.reason.includes("destination") || p.key.toLowerCase().includes("dest") || p.key.toLowerCase().includes("url"),
  );

  // Check for nested redirect parameters
  if (redirectParams.length > 0) {
    const targetParam = redirectParams[0];
    let destinationUrl = targetParam.value;

    try {
      if (destinationUrl.startsWith("http%3A") || destinationUrl.startsWith("https%3A")) {
        destinationUrl = decodeURIComponent(destinationUrl);
      }
      const destParsed = new URL(destinationUrl);
      const isCrossHost = destParsed.hostname.toLowerCase() !== summary.fqdn.toLowerCase();
      const isCrossTld = destParsed.hostname.split(".").pop()?.toLowerCase() !== summary.tld.replace(/^\./, "").toLowerCase();
      const isDowngrade = summary.scheme === "https" && destParsed.protocol === "http:";

      const hop1: RedirectHop = {
        index: 1,
        url: urlResult.normalized,
        status: 302,
        destination: destinationUrl,
        redirectMethod: "location",
        intermediateDomains: [summary.domain],
      };

      const hop2: RedirectHop = {
        index: 2,
        url: destinationUrl,
        status: 200,
        destination: destinationUrl,
        redirectMethod: "unknown",
        intermediateDomains: [destParsed.hostname],
      };

      const chain: RedirectChain = {
        hopCount: 2,
        finalUrl: destinationUrl,
        finalHost: destParsed.hostname,
        finalStatus: 200,
        crossesHosts: isCrossHost,
        crossesTlds: isCrossTld,
        hasChainLoops: false,
        hops: [hop1, hop2],
        warnings: [
          ...(isCrossHost ? [`Redirect parameter passes traffic cross-domain to ${destParsed.hostname}`] : []),
          ...(isDowngrade ? ["Redirect downgrades encryption from HTTPS to plaintext HTTP"] : []),
        ],
      };

      if (isCrossHost) {
        findings.push({
          id: `finding-redirect-cross-host-${now}`,
          category: "behavior",
          nature: "heuristic_indicator",
          finding: `Cross-domain redirect pattern to ${destParsed.hostname}`,
          severity: "medium",
          evidence: `The URL's destination parameter (?${targetParam.key}=) immediately redirects the visitor from '${summary.fqdn}' to a completely different domain '${destParsed.hostname}'. Open redirects are commonly exploited in phishing campaigns to mask malicious URLs behind trusted gateways.`,
          confidence: 0.88,
          source: "redirect-analyzer",
          timestamp: now,
          metadata: {
            sourceHost: summary.fqdn,
            destinationHost: destParsed.hostname,
            param: targetParam.key,
          },
        });
      }

      if (isDowngrade) {
        findings.push({
          id: `finding-redirect-downgrade-${now}`,
          category: "infrastructure",
          nature: "heuristic_indicator",
          finding: `Insecure protocol downgrade in redirect chain (${summary.scheme.toUpperCase()} -> ${destParsed.protocol.replace(":", "").toUpperCase()})`,
          severity: "high",
          evidence: `The redirect chain transitions from an encrypted origin (${summary.scheme}) to an unencrypted destination (${destParsed.protocol}).`,
          confidence: 0.95,
          source: "redirect-analyzer",
          timestamp: now,
        });
      }

      return { chain, findings };
    } catch {
      // destination value wasn't a valid full URL
    }
  }

  return { findings };
}
