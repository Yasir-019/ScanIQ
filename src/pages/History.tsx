import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Trash2, Star, Link as LinkIcon, Wifi, User, Mail, MessageSquare, Phone, MapPin, Package, FileText, CreditCard } from "lucide-react";
import type { ScanRecord, ScanContentType } from "@/lib/scan/types";
import { ResultSheet } from "@/components/ResultSheet";
import { toast } from "sonner";

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

export default function HistoryScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [active, setActive] = useState<ScanRecord | null>(null);

  const all = useLiveQuery(() => db.scans.orderBy("scannedAt").reverse().toArray(), []);

  const filtered = useMemo(() => {
    let list = all ?? [];
    if (tab === "favorites") list = list.filter((s) => s.favorite);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.content.toLowerCase().includes(q));
    }
    return list;
  }, [all, tab, query]);

  const remove = async (id: string) => {
    await db.scans.delete(id);
    toast(t("history.deleted"));
  };

  const clearAll = async () => {
    await db.scans.clear();
    toast(t("history.cleared"));
  };

  return (
    <div className="safe-top h-full overflow-y-auto pb-2">
      <div className="sticky top-0 z-10 space-y-3 bg-background/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{t("history.title")}</h1>
          {(all?.length ?? 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
              {t("common.clear")}
            </Button>
          )}
        </div>

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
      </div>

      <ul className="space-y-2 px-4 pt-2">
        {filtered.length === 0 && (
          <li className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {tab === "favorites" ? t("history.emptyFavorites") : t("history.emptyAll")}
          </li>
        )}
        {filtered.map((s) => {
          const Icon = typeIcon[s.type] ?? FileText;
          return (
            <li key={s.id}>
              <button
                onClick={() => setActive(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-card transition active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate font-medium">
                    {s.favorite && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                    <span className="truncate">{s.content}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.type} · {formatTime(s.scannedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(s.id);
                  }}
                  className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </button>
            </li>
          );
        })}
      </ul>

      <ResultSheet scan={active} onClose={() => setActive(null)} />
    </div>
  );
}
