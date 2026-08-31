import React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  AlertTriangle,
  Radio,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  DatabaseZap,
} from "lucide-react";
import type { RiskLevel } from "@/lib/scan/types";
import type { FindingSeverity } from "@/lib/investigation/types";

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
    icon: AlertTriangle,
    classes: "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium",
    dotColor: "bg-blue-500",
  },
  informational: {
    label: "INFO",
    icon: CheckCircle2,
    classes: "border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    dotColor: "bg-cyan-500",
  },
  benign: {
    label: "BENIGN",
    icon: ShieldCheck,
    classes: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  safe: {
    label: "SAFE",
    icon: ShieldCheck,
    classes: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  suspicious: {
    label: "SUSPICIOUS",
    icon: ShieldAlert,
    classes: "border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold",
    dotColor: "bg-orange-500",
  },
  malicious: {
    label: "MALICIOUS",
    icon: ShieldX,
    classes: "border-red-600/40 bg-red-600/15 text-red-600 dark:text-red-400 font-bold",
    dotColor: "bg-red-500",
  },
  unknown: {
    label: "UNKNOWN",
    icon: ShieldQuestion,
    classes: "border-slate-500/40 bg-slate-500/15 text-muted-foreground",
    dotColor: "bg-slate-500",
  },
  in_progress: {
    label: "SCANNING",
    icon: Clock,
    classes: "border-primary/40 bg-primary/10 text-primary animate-pulse",
    dotColor: "bg-primary",
  },
  unsupported: {
    label: "UNSUPPORTED",
    icon: HelpCircle,
    classes: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
};

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
