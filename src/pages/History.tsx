import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Trash2, Star, Link as LinkIcon, Wifi, User, Mail, MessageSquare, Phone, MapPin, Package, FileText } from "lucide-react";
import type { ScanRecord, ScanContentType } from "@/lib/scan/types";
import { ResultSheet } from "@/components/ResultSheet";
import { toast } from "sonner";

// Use a simple container with overflow-y-auto instead of react-window for now to fix build issues
// and still keep the flex layout improvements.
// We will optimize this later with a more stable virtualization library if needed.

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
};

function formatTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function HistoryScreen() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [active, setActive] = useState<ScanRecord | null>(null);

  const all = useLiveQuery(async () => {
     const collection = db.scans.orderBy("scannedAt").reverse();
     
     if (tab === "favorites") {
       // If we only want favorites, we can use the index
       return await db.scans.where("favorite").equals(true).reverse().sortBy("scannedAt");
     }
     
     const results = await collection.toArray();
     
     if (query.trim()) {
       const q = query.toLowerCase();
       return results.filter(s => s.content.toLowerCase().includes(q));
     }
     
     return results;
   }, [tab, query]);

  const filtered = all ?? [];

  const remove = useCallback(async (id: string) => {
    await db.scans.delete(id);
    toast("Deleted");
  }, []);

  const clearAll = async () => {
    await db.scans.clear();
    toast("History cleared");
  };

  return (
    <div className="safe-top h-full flex flex-col overflow-hidden">
      <div className="z-10 space-y-3 bg-background/90 px-4 pb-3 pt-4 backdrop-blur shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          {(all?.length ?? 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
              Clear
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scans"
            className="h-11 rounded-2xl pl-9"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "favorites")}>
          <TabsList className="grid w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl">All</TabsTrigger>
            <TabsTrigger value="favorites" className="rounded-xl">Favorites</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 pt-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-10">
            <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {tab === "favorites" ? "No favorites yet. Star a scan to save it." : "No scans yet. Start scanning!"}
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-4 pb-4">
            {filtered.map((s) => {
              const Icon = typeIcon[s.type] ?? FileText;
              return (
                <div key={s.id}>
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
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ResultSheet scan={active} onClose={() => setActive(null)} />
    </div>
  );
}
