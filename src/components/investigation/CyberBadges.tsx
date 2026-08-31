import {
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldX,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SEVERITY_CONFIG,
  EVIDENCE_NATURE_CONFIG,
} from "./badge-config";

export type { SeverityType, EvidenceNatureType } from "./badge-config";

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
