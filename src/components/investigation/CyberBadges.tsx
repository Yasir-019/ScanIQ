import React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  Info,
  AlertTriangle,
  Radio,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Layers,
  DatabaseZap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FindingSeverity, RiskLevel } from "@/lib/scan/types";

// ==========================================
// 1. Unified Severity Badges (Never color alone)
// ==========================================
export type SeverityType = FindingSeverity | RiskLevel | "informational" | "benign";

export const SEVERITY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; classes: string; dotColor: string }
> = {
  critical: {
    label: "CRITICAL",
    icon: ShieldX,
    classes: "border-red-600/40 bg-red-600/15 text-red-600 dark:text-red-400 font-bold",
    dotColor: "bg-red-500",
  },
  high: {
    label: "HIGH",
    icon: ShieldAlert,
    classes: "border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold",
    dotColor: "bg-orange-500",
  },
  medium: {
    label: "MEDIUM",
    icon: AlertTriangle,
    classes: "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold",
    dotColor: "bg-amber-500",
  },
  low: {
    label: "LOW",
    icon: Info,
    classes: "border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-medium",
    dotColor: "bg-cyan-500",
  },
  informational: {
    label: "INFORMATIONAL",
    icon: ShieldCheck,
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
    dotColor: "bg-emerald-500",
  },
  benign: {
    label: "BENIGN",
    icon: ShieldCheck,
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
    dotColor: "bg-emerald-500",
  },
  unknown: {
    label: "UNKNOWN",
    icon: ShieldQuestion,
    classes: "border-border bg-secondary/60 text-muted-foreground font-medium",
    dotColor: "bg-muted-foreground",
  },
};

export function SeverityBadge({
  severity,
  className,
  showIcon = true,
}: {
  severity: string;
  className?: string;
  showIcon?: boolean;
}) {
  const norm = severity?.toLowerCase() || "unknown";
  const conf = SEVERITY_CONFIG[norm] || SEVERITY_CONFIG.unknown;
  const Icon = conf.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-md border",
        conf.classes,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span>{conf.label}</span>
    </Badge>
  );
}

// ==========================================
// 2. Evidence Nature Badges
// ==========================================
export type EvidenceNatureType =
  | "observed_fact"
  | "heuristic_indicator"
  | "external_intelligence"
  | "inferred_conclusion";

export const EVIDENCE_NATURE_CONFIG: Record<
  string,
  { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }
> = {
  observed_fact: {
    label: "Observed Fact",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  heuristic_indicator: {
    label: "Heuristic Indicator",
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: Layers,
  },
  external_intelligence: {
    label: "External OSINT",
    classes: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: DatabaseZap,
  },
  inferred_conclusion: {
    label: "Inferred Conclusion",
    classes: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    icon: Radio,
  },
};

export function EvidenceNatureBadge({
  nature,
  className,
}: {
  nature?: string;
  className?: string;
}) {
  if (!nature) return null;
  const norm = nature.toLowerCase();
  const conf = EVIDENCE_NATURE_CONFIG[norm] || {
    label: nature.replace(/_/g, " "),
    classes: "border-border bg-secondary/50 text-muted-foreground",
    icon: Info,
  };
  const Icon = conf.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border",
        conf.classes,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{conf.label}</span>
    </Badge>
  );
}

// ==========================================
// 3. Provider State Badges
// ==========================================
export type ProviderStatusType =
  | "success"
  | "clean"
  | "malicious"
  | "suspicious"
  | "not_configured"
  | "disabled"
  | "consent_required"
  | "no_data"
  | "unavailable"
  | "rate_limited"
  | "error";

export function ProviderStatusBadge({
  status,
  label,
  className,
}: {
  status: ProviderStatusType | string;
  label?: string;
  className?: string;
}) {
  let badgeStyle = "border-border bg-secondary text-muted-foreground";
  let displayLabel = label || status;
  let Icon = Info;

  switch (status) {
    case "malicious":
      badgeStyle = "border-red-600/40 bg-red-600/15 text-red-600 dark:text-red-400 font-semibold";
      displayLabel = label || "Malicious Match";
      Icon = ShieldX;
      break;
    case "suspicious":
      badgeStyle = "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold";
      displayLabel = label || "Suspicious Signal";
      Icon = AlertTriangle;
      break;
    case "clean":
    case "success":
      badgeStyle = "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      displayLabel = label || "Clean / Verified";
      Icon = CheckCircle2;
      break;
    case "not_configured":
      badgeStyle = "border-border/80 bg-secondary/50 text-muted-foreground";
      displayLabel = label || "Not Configured";
      Icon = HelpCircle;
      break;
    case "disabled":
      badgeStyle = "border-border bg-secondary/30 text-muted-foreground opacity-80";
      displayLabel = label || "Disabled";
      Icon = XCircle;
      break;
    case "consent_required":
      badgeStyle = "border-amber-500/30 bg-amber-500/10 text-amber-500";
      displayLabel = label || "Consent Required";
      Icon = Clock;
      break;
    case "rate_limited":
    case "unavailable":
      badgeStyle = "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      displayLabel = label || "Temporarily Unavailable";
      Icon = AlertTriangle;
      break;
    case "error":
      badgeStyle = "border-border bg-secondary text-destructive/80";
      displayLabel = label || "Lookup Error";
      Icon = AlertTriangle;
      break;
  }

  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border", badgeStyle, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{displayLabel}</span>
    </Badge>
  );
}
