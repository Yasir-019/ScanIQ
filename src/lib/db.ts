import Dexie, { type Table } from "dexie";
import type { InvestigationCase, InvestigationReport, ScanRecord } from "./scan/types";

export class ScanIQDB extends Dexie {
  scans!: Table<ScanRecord, string>;
  investigations!: Table<InvestigationReport, string>;
  cases!: Table<InvestigationCase, string>;

  constructor() {
    super("scaniq-osint");
    this.version(2)
      .stores({
        scans: "id, scannedAt, type, format, favorite, content, investigationId, caseId",
        cases: "id, createdAt, updatedAt, starred, latestRiskLevel",
        investigations: "id, caseId, createdAt, updatedAt, status, sourceScanId",
      })
      .upgrade(async (tx) => {
        // Legacy v1 DB: any migrated scans get back-filled into a default case.
        try {
          const scans = await tx.db.table<ScanRecord, string>("scans").toArray();
          if (scans.length > 0) {
            const defaultCaseId = `case-migrated-${Date.now()}`;
            await tx.db.table<InvestigationCase, string>("cases").put({
              id: defaultCaseId,
              label: "Migrated scans",
              tags: ["migrated"],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              starred: false,
            });
            for (const s of scans) {
              if (!s.caseId) {
                await tx.db
                  .table<ScanRecord, string>("scans")
                  .put({ ...s, caseId: defaultCaseId });
              }
            }
          }
        } catch {
          /* no-op if migration fails silently */
        }
      });
  }
}

export const db = new ScanIQDB();

export const DEFAULT_CASE_LIMIT = 500;

export async function pruneCases(limit = DEFAULT_CASE_LIMIT): Promise<number> {
  const count = await db.cases.count();
  if (count <= limit) return 0;

  const overflow = count - limit;
  const oldest = await db.cases.orderBy("updatedAt").limit(overflow).primaryKeys();
  if (oldest.length) {
    const scans = await db.scans.where("caseId").anyOf(oldest).delete();
    const invs = await db.investigations.where("caseId").anyOf(oldest).delete();
    await db.cases.bulkDelete(oldest);
    return oldest.length + scans + invs;
  }
  return 0;
}

export async function saveNewCaseForScan(scan: ScanRecord): Promise<InvestigationCase> {
  const caseId = `case-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  const c: InvestigationCase = {
    id: caseId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    starred: false,
    notes: "",
  };
  await db.cases.put(c);
  await db.scans.put({ ...scan, caseId });
  return c;
}
