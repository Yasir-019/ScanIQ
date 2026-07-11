import { useMemo, useState, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Trash2, Star, Link as LinkIcon, Wifi, User, Mail, MessageSquare, Phone, MapPin, Package, FileText, CreditCard } from "lucide-react";
import type { ScanRecord, ScanContentType, ScanFormat } from "@/lib/scan/types";
import { ResultSheet } from "@/components/ResultSheet";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings";

const typeIcon: Record<ScanContentType, React.ComponentType<{ className?: string }>> = {
  url: LinkIcon,
  wifi: Wifi,
  vcard: User,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  geo: MapPin,
  product: Package,
  text: FileText,
  payment: CreditCard,
};

function formatTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const HistoryItem = memo(function HistoryItem({
  scan,
  onSelect,
  onDelete,
}: {
  scan: ScanRecord;
  onSelect: (s: ScanRecord) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = typeIcon[scan.type] ?? FileText;
  return (
    <li>
      <div className="group relative flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card transition active:scale-[0.99] hover:bg-secondary/20">
        <button
          onClick={() => onSelect(scan)}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
          aria-label={`${scan.type} scan. content: ${scan.content}`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 truncate font-medium">
              {scan.favorite && <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />}
              <span className="truncate">{scan.content}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {scan.type} · {formatTime(scan.scannedAt)}
            </div>
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(scan.id);
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          aria-label={`Delete ${scan.type} scan`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
});

export default function HistoryScreen() {
  const { t } = useTranslation();
  const isPro = useSettings((s) => s.isPro);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [mode, setMode] = useState<"scanned" | "generated">("scanned");
  const [active, setActive] = useState<ScanRecord | null>(null);

  const all = useLiveQuery(() => db.scans.orderBy("scannedAt").reverse().toArray(), []);
  const generatedCodes = useLiveQuery(() => db.generated.orderBy("createdAt").reverse().toArray(), []);

  const filtered = useMemo(() => {
    let list = all ?? [];
    if (tab === "favorites") list = list.filter((s) => s.favorite);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.content.toLowerCase().includes(q));
    }
    return list;
  }, [all, tab, query]);

  const remove = useCallback(async (id: string) => {
    const item = await db.scans.get(id);
    if (!item) return;
    await db.scans.delete(id);
    toast(t("history.deleted", "Scan deleted"), {
      action: {
        label: t("common.undo", "Undo"),
        onClick: async () => {
          await db.scans.put(item);
          toast.success(t("history.restored", "Scan restored"));
        },
      },
    });
  }, [t]);

  const removeGen = useCallback(async (id: string) => {
    const item = await db.generated.get(id);
    if (!item) return;
    await db.generated.delete(id);
    toast("Generated QR code deleted", {
      action: {
        label: t("common.undo", "Undo"),
        onClick: async () => {
          await db.generated.put(item);
          toast.success("Generated QR code restored");
        },
      },
    });
  }, [t]);

  const clearAll = async () => {
    const confirmMsg = mode === "scanned"
      ? t("history.confirmClearScanned", "Are you sure you want to clear your entire scan history? This cannot be undone.")
      : "Are you sure you want to clear your entire generated QR history? This cannot be undone.";
    const ok = window.confirm(confirmMsg);
    if (!ok) return;

    if (mode === "scanned") {
      await db.scans.clear();
      toast.success(t("history.cleared"));
    } else {
      await db.generated.clear();
      toast.success("Generated QR history cleared");
    }
  };

  const exportCSV = () => {
    if (!all || all.length === 0) return;
    const headers = ["ID", "Content", "Format", "Type", "Scanned At"];
    const rows = all.map((s) => [
      s.id,
      `"${s.content.replace(/"/g, '""')}"`,
      s.format,
      s.type,
      new Date(s.scannedAt).toISOString(),
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scaniq-history-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("History exported to CSV successfully!");
  };

  return (
    <div className="safe-top h-full overflow-y-auto pb-2">
      <div className="sticky top-0 z-10 space-y-3 bg-background/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{t("history.title")}</h1>
          <div className="flex gap-2">
            {isPro && mode === "scanned" && (all?.length ?? 0) > 0 && (
              <Button variant="ghost" size="sm" onClick={exportCSV} className="text-primary hover:text-primary/80">
                Export CSV
              </Button>
            )}
            {((mode === "scanned" && (all?.length ?? 0) > 0) || (mode === "generated" && (generatedCodes?.length ?? 0) > 0)) && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-destructive">
                {t("common.clear")}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "scanned" | "generated")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="scanned" className="rounded-xl">Scanned</TabsTrigger>
            <TabsTrigger value="generated" className="rounded-xl">Generated</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "scanned" && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("history.searchPlaceholder")}
                className="h-11 rounded-2xl pl-9"
              />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "favorites")}>
              <TabsList className="grid w-full grid-cols-2 rounded-2xl">
                <TabsTrigger value="all" className="rounded-xl">{t("history.tabAll")}</TabsTrigger>
                <TabsTrigger value="favorites" className="rounded-xl">{t("history.tabFavorites")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
      </div>

      {mode === "scanned" ? (
        <ul className="space-y-2 px-4 pt-2">
          {filtered.length === 0 && (
            <li className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {tab === "favorites" ? t("history.emptyFavorites") : t("history.emptyAll")}
            </li>
          )}
          {filtered.map((s) => (
            <HistoryItem key={s.id} scan={s} onSelect={setActive} onDelete={remove} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2 px-4 pt-2">
          {(!generatedCodes || generatedCodes.length === 0) && (
            <li className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No generated QR codes yet. Create one in the Generate tab!
            </li>
          )}
          {generatedCodes?.map((g) => {
            const mockScan: ScanRecord = {
              id: g.id,
              content: g.payload,
              format: "QR_CODE" as ScanFormat,
              type: g.type,
              scannedAt: g.createdAt,
            };
            return (
              <HistoryItem key={g.id} scan={mockScan} onSelect={setActive} onDelete={removeGen} />
            );
          })}
        </ul>
      )}

      <ResultSheet scan={active} onClose={() => setActive(null)} />
    </div>
  );
}
