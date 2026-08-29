import Dexie, { type Table } from "dexie";
import type { GeneratedCode, ScanRecord } from "./scan/types";

export class ScanIQDB extends Dexie {
  scans!: Table<ScanRecord, string>;
  generated!: Table<GeneratedCode, string>;

  constructor() {
    super("scaniq");
    this.version(1).stores({
      scans: "id, scannedAt, type, format, favorite, content",
      generated: "id, createdAt, type",
    });
  }
}

export const db = new ScanIQDB();

/**
 * Case history is unlimited and local-only — there is no paid tier.
 * This helper exists for user-initiated retention cleanup only.
 */
export async function pruneHistory(limit: number) {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  const count = await db.scans.count();
  if (count <= limit) return 0;

  const overflow = count - limit;
  const ids: string[] = [];
  const all = await db.scans.orderBy("scannedAt").toArray();
  for (const s of all) {
    if (ids.length >= overflow) break;
    if (!s.favorite) ids.push(s.id);
  }
  if (ids.length) await db.scans.bulkDelete(ids);
  return ids.length;
}
