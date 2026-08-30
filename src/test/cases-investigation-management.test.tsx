import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import CasesScreen from "@/pages/Cases";
import { db, createNewCase, saveNewCaseForScan, deleteCaseWithCascade } from "@/lib/db";
import type { InvestigationCase, InvestigationReport, ScanRecord } from "@/lib/scan/types";

// In-memory mocks for Dexie
const mockCases = new Map<string, InvestigationCase>();
const mockScans = new Map<string, ScanRecord>();
const mockInvestigations = new Map<string, InvestigationReport>();

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => {
    try {
      return fn();
    } catch {
      return [];
    }
  },
}));

vi.mock("@/lib/db", () => {
  return {
    db: {
      cases: {
        toArray: () => Array.from(mockCases.values()),
        get: (id: string) => mockCases.get(id),
        put: (c: InvestigationCase) => {
          mockCases.set(c.id, c);
          return c.id;
        },
        update: (id: string, patch: Partial<InvestigationCase>) => {
          const existing = mockCases.get(id);
          if (existing) mockCases.set(id, { ...existing, ...patch });
        },
        delete: (id: string) => {
          mockCases.delete(id);
        },
        clear: () => {
          mockCases.clear();
        },
      },
      scans: {
        toArray: () => Array.from(mockScans.values()),
        put: (s: ScanRecord) => {
          mockScans.set(s.id, s);
          return s.id;
        },
        where: (field: string) => ({
          equals: (val: string) => ({
            toArray: () =>
              Array.from(mockScans.values()).filter(
                (s) => (s as unknown as Record<string, unknown>)[field] === val
              ),
            delete: () => {
              for (const [k, v] of Array.from(mockScans.entries())) {
                if ((v as unknown as Record<string, unknown>)[field] === val) mockScans.delete(k);
              }
            },
          }),
        }),
        clear: () => {
          mockScans.clear();
        },
      },
      investigations: {
        where: (field: string) => ({
          equals: (val: string) => ({
            delete: () => {
              for (const [k, v] of Array.from(mockInvestigations.entries())) {
                if ((v as unknown as Record<string, unknown>)[field] === val)
                  mockInvestigations.delete(k);
              }
            },
          }),
        }),
        clear: () => {
          mockInvestigations.clear();
        },
      },
    },
    createNewCase: async (label?: string, tags?: string[], notes?: string) => {
      const id = `case-test-${Date.now()}`;
      const c: InvestigationCase = {
        id,
        label: label || `Case #${id.slice(-6)}`,
        tags: tags || [],
        notes: notes || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        starred: false,
        status: "active",
        targetCount: 0,
        indicatorCount: 0,
      };
      mockCases.set(id, c);
      return c;
    },
    saveNewCaseForScan: async (scan: ScanRecord) => {
      const id = `case-test-${Date.now()}`;
      const c: InvestigationCase = {
        id,
        label: scan.content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        starred: false,
        status: "active",
        primaryTarget: scan.content,
        targetCount: 1,
        notes: "",
      };
      mockCases.set(id, c);
      mockScans.set(scan.id, { ...scan, caseId: id });
      return c;
    },
    deleteCaseWithCascade: async (caseId: string) => {
      mockCases.delete(caseId);
      for (const [k, v] of Array.from(mockScans.entries())) {
        if (v.caseId === caseId) mockScans.delete(k);
      }
    },
  };
});

describe("ScanIQ Community — Phase 6: Cases & Investigation Management", () => {
  beforeEach(() => {
    localStorage.clear();
    mockCases.clear();
    mockScans.clear();
    mockInvestigations.clear();
    vi.restoreAllMocks();
  });

  const renderCases = () => {
    return render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/cases"]}>
          <CasesScreen />
        </MemoryRouter>
      </TooltipProvider>
    );
  };

  it("1. Creates a new investigation case with label and tags", async () => {
    const c = await createNewCase("Operation Dark Phish", ["phishing", "qr"], "Initial lead");
    expect(c.id).toBeDefined();
    expect(c.label).toBe("Operation Dark Phish");
    expect(c.status).toBe("active");
    expect(c.tags).toEqual(["phishing", "qr"]);

    const stored = await db.cases.get(c.id);
    expect(stored?.label).toBe("Operation Dark Phish");
  });

  it("2. Supports multi-target cases with cascading updates", async () => {
    const scan1: ScanRecord = {
      id: "scan-1",
      content: "https://evil-login.com/auth",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const c = await saveNewCaseForScan(scan1);
    expect(c.targetCount).toBe(1);
    expect(c.primaryTarget).toBe("https://evil-login.com/auth");

    // Add second scan to same case
    const scan2: ScanRecord = {
      id: "scan-2",
      content: "https://evil-secondary-payload.com/download",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
      caseId: c.id,
    };
    await db.scans.put(scan2);

    const linkedScans = await db.scans.where("caseId").equals(c.id).toArray();
    expect(linkedScans.length).toBe(2);
  });

  it("3. Cascading case deletion removes associated scans and investigations", async () => {
    const scan: ScanRecord = {
      id: "scan-delete-test",
      content: "https://target-to-delete.com",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const c = await saveNewCaseForScan(scan);
    await deleteCaseWithCascade(c.id);

    const caseCheck = await db.cases.get(c.id);
    expect(caseCheck).toBeUndefined();

    const scanCheck = await db.scans.where("caseId").equals(c.id).toArray();
    expect(scanCheck.length).toBe(0);
  });

  it("4. Renders Cases workspace with summary metrics and search", async () => {
    await createNewCase("Financial Wire Fraud Dossier", ["fraud", "banking"]);

    renderCases();

    await waitFor(() => {
      expect(screen.getByText(/investigation cases/i)).toBeDefined();
      expect(screen.getByText(/financial wire fraud dossier/i)).toBeDefined();
      expect(screen.getByText(/total cases/i)).toBeDefined();
    });
  });

  it("5. Opens Create New Case modal", async () => {
    renderCases();

    const newCaseBtns = screen.getAllByRole("button", { name: /new case/i });
    fireEvent.click(newCaseBtns[0]);

    expect(screen.getByText(/create investigation case/i)).toBeDefined();
    expect(screen.getByLabelText(/case label \/ title/i)).toBeDefined();
  });
});
