import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { investigationEngine } from "@/lib/investigation";
import type { ScanRecord } from "@/lib/scan/types";

// Helper component that throws an intentional error for ErrorBoundary testing
function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Intentional test crash");
  }
  return <div data-testid="healthy-child">Healthy Content</div>;
}

describe("Phase 18: PWA, Offline & Application Startup Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Offline State & UI Banner", () => {
    it("renders OfflineBanner when browser network is offline", () => {
      // Mock navigator.onLine = false
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
        writable: true,
      });

      render(<OfflineBanner />);
      const banner = document.querySelector(".fixed.inset-x-0.top-0");
      expect(banner).toBeInTheDocument();
    });

    it("hides OfflineBanner when browser network is online", () => {
      // Mock navigator.onLine = true
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
        writable: true,
      });

      const { container } = render(<OfflineBanner />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("2. Offline Analysis Execution", () => {
    it("runs complete QR/barcode investigation without active internet connection", async () => {
      // Offline mode: no network requests permitted
      const scan: ScanRecord = {
        id: "scan-offline-pwa",
        content: "https://offline-target.example.org/path",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-offline-pwa", {
        userConsent: false, // Disallows external outbound calls
      });

      expect(report.status).toBe("complete");
      expect(report.intelligenceFlags.dnsEnabled).toBe(false);
      expect(report.intelligenceFlags.reputationEnabled).toBe(false);
      expect(report.finalRisk).toBeDefined();
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("3. Error Boundary Resilience & Crash Recovery", () => {
    it("catches render exceptions, displays error UI, and allows recovery", () => {
      // Prevent console.error from polluting test output
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { rerender } = render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );

      // Verify ErrorBoundary caught the error and rendered fallback
      expect(screen.getByText("Intentional test crash")).toBeInTheDocument();

      // Now rerender with fixed child and trigger reset
      rerender(
        <ErrorBoundary>
          <ProblemChild shouldThrow={false} />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(tryAgainButton);

      expect(screen.getByTestId("healthy-child")).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
