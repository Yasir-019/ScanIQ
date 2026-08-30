import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Trash2,
  Star,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
} from "lucide-react";
import type { InvestigationCase, RiskLevel } from "@/lib/scan/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/investigation/CyberBadges";

function CaseRow({
  c,
  open,
  remove,
  toggleStar,
}: {
  c: InvestigationCase;
  open: (id: string) => void;
  remove: (id: string) => void;
  toggleStar: (id: string, current: boolean) => void;
}) {
  const risk = c.latestRiskLevel ?? "unknown";
  const date = new Date(c.updatedAt);

  return (
    <li>
      <div className="group relative flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm transition hover:border-primary/40 hover:bg-secondary/20">
        <button
          onClick={() => open(c.id)}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Briefcase className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 truncate">
              <span className="truncate font-bold text-xs sm:text-sm text-foreground">
                {c.label || `Case #${c.id.replace("case-", "").slice(0, 8)}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="h-3 w-3" />
                {date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {c.tags && c.tags.length > 0 && (
                <span className="max-w-40 truncate">· {c.tags.join(", ")}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SeverityBadge severity={risk} />
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-border/50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleStar(c.id, !!c.starred);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-warning transition-colors"
            aria-label={c.starred ? "Unstar case" : "Star case"}
          >
            <Star className={cn("h-4 w-4", c.starred && "fill-warning text-warning")} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              remove(c.id);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
            aria-label={`Delete case ${c.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function CasesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "starred" | "active">("all");

  const cases = useLiveQuery(() => db.cases.orderBy("updatedAt").reverse().toArray(), []);

  const filtered = useMemo(() => {
    let list = cases ?? [];
    if (tab === "starred") list = list.filter((c) => c.starred);
    if (tab === "active")
      list = list.filter((c) => {
        const risk = c.latestRiskLevel;
        return risk === "high" || risk === "critical" || risk === "medium";
      });
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          (c.label ?? "").toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.tags ?? []).join(" ").toLowerCase().includes(q) ||
          (c.notes ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [cases, tab, query]);

  const open = (id: string) => {
    const inv = cases?.find((c) => c.id === id)?.latestInvestigationId;
    if (inv) navigate(`/investigation/${inv}`);
    else toast.error("No investigation data available for this case.");
  };

  const toggleStar = useCallback(async (id: string, current: boolean) => {
    await db.cases.update(id, { starred: !current });
    toast.success(!current ? "Case starred" : "Case unstarred");
  }, []);

  const remove = useCallback(async (id: string) => {
    const item = await db.cases.get(id);
    if (!item) return;
    await Promise.all([
      db.cases.delete(id),
      db.scans.where("caseId").equals(id).delete(),
      db.investigations.where("caseId").equals(id).delete(),
    ]);
    toast("Case deleted", {
      action: {
        label: t("common.undo", "Undo"),
        onClick: async () => {
          if (!item) return;
          await db.cases.put(item);
          toast.success("Case restored");
        },
      },
    });
  }, [t]);

  const clearAll = async () => {
    const ok = window.confirm(
      "Permanently delete ALL investigation cases, scans, and reports from local storage?",
    );
    if (!ok) return;
    await Promise.all([db.cases.clear(), db.scans.clear(), db.investigations.clear()]);
    toast.success("All investigation cases cleared.");
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <span>Investigation Cases</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Local-first, encrypted case files for all scanned payloads and intelligence runs.
            </p>
          </div>

          {(cases?.length ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              className="text-xs h-8 text-muted-foreground hover:text-destructive border-border"
            >
              Clear All Cases
            </Button>
          )}
        </div>

        {/* Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/50">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "all" | "starred" | "active")}
            className="w-full sm:col-span-1"
          >
            <TabsList className="grid w-full grid-cols-3 rounded-xl h-9 p-1 bg-secondary/50">
              <TabsTrigger value="all" className="rounded-lg text-xs py-1">
                All ({cases?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="active" className="rounded-lg text-xs py-1">
                Risks
              </TabsTrigger>
              <TabsTrigger value="starred" className="rounded-lg text-xs py-1">
                Starred
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cases by label, target domain, tags, or ID…"
              className="h-9 rounded-xl pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Case List */}
      <ul className="space-y-2">
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground space-y-2">
            <Briefcase className="mx-auto h-8 w-8 opacity-40 text-primary" />
            <p className="font-semibold text-foreground">No cases found</p>
            <p>
              {tab === "starred"
                ? "You have not starred any investigation cases yet."
                : tab === "active"
                ? "No active-risk cases detected."
                : "Scan a QR or barcode in the Scan tab to open your first case."}
            </p>
          </li>
        )}
        {filtered.map((c) => (
          <CaseRow
            key={c.id}
            c={c}
            open={open}
            remove={remove}
            toggleStar={toggleStar}
          />
        ))}
      </ul>
    </div>
  );
}
