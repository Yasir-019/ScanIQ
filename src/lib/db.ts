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

export const FREE_HISTORY_LIMIT = 50;

export async function pruneFreeHistory(limit = FREE_HISTORY_LIMIT) {
  const count = await db.scans.count();
  if (count <= limit) return 0;
  
  const overflow = count - limit;
  
  // Find the IDs of the oldest non-favorite scans to delete
  const scansToDelete = await db.scans
    .orderBy("scannedAt")
    .filter(scan => !scan.favorite)
    .limit(overflow)
    .primaryKeys();

  if (scansToDelete.length > 0) {
    await db.scans.bulkDelete(scansToDelete);
  }

  // Also prune generated codes history
  const genCount = await db.generated.count();
  if (genCount > limit) {
    const genOverflow = genCount - limit;
    const genToDelete = await db.generated
      .orderBy("createdAt")
      .limit(genOverflow)
      .primaryKeys();

    if (genToDelete.length > 0) {
      await db.generated.bulkDelete(genToDelete);
    }
  }
  
  return scansToDelete.length;
}
