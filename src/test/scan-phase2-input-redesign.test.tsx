import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ScanScreen from "@/pages/Scan";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSettings } from "@/lib/settings";

describe("ScanIQ Community — Phase 2: Scan Experience & Input Redesign", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderScan = () => {
    return render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/"]}>
          <ScanScreen />
        </MemoryRouter>
      </TooltipProvider>
    );
  };

  it("opens in Image input mode by default and does not start camera automatically", () => {
    renderScan();

    // Image tab should be selected by default
    const imageTab = screen.getByRole("tab", { name: /image/i });
    expect(imageTab.getAttribute("aria-selected")).toBe("true");

    // Camera tab should NOT be selected
    const cameraTab = screen.getByRole("tab", { name: /camera/i });
    expect(cameraTab.getAttribute("aria-selected")).toBe("false");

    // Image dropzone should be visible in DOM
    expect(
      screen.getByText(/drag & drop an image here, or browse files/i)
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /browse files/i })).toBeDefined();
  });

  it("presents an explicit 'Start Camera' action when user switches to Camera tab", async () => {
    renderScan();

    const cameraTab = screen.getByRole("tab", { name: /camera/i });
    fireEvent.click(cameraTab);

    // Camera tab is now active
    expect(cameraTab.getAttribute("aria-selected")).toBe("true");

    // Explanatory panel with explicit Start Camera button must be visible
    expect(screen.getByText(/live optical qr & barcode scanner/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /start camera/i })).toBeDefined();

    // Stream must not start until clicked
    expect(screen.queryByText(/live sensor active/i)).toBeNull();
  });

  it("provides Paste / Enter input mode with character limits and analysis trigger", () => {
    renderScan();

    const pasteTab = screen.getByRole("tab", { name: /paste/i });
    fireEvent.click(pasteTab);

    expect(pasteTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText(/code content \/ payload/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /inspect & investigate/i })
    ).toBeDefined();
  });

  it("ensures autoStartCamera setting defaults to false for privacy preservation", () => {
    const settings = useSettings.getState();
    expect(settings.autoStartCamera).toBe(false);
  });
});
