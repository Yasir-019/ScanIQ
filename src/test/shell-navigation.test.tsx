import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("ScanIQ Community — Phase 1: Application Shell & Navigation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderShell = (initialRoute = "/") => {
    return render(
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AppShell />
        </MemoryRouter>
      </TooltipProvider>
    );
  };

  it("renders the primary navigation destinations", () => {
    renderShell();

    // Check desktop primary nav links
    const primaryNav = screen.getByLabelText("Primary Navigation");
    expect(primaryNav).toBeDefined();

    expect(screen.getAllByRole("link", { name: /scan/i })[0]).toBeDefined();
    expect(screen.getAllByRole("link", { name: /cases/i })[0]).toBeDefined();
    expect(screen.getAllByRole("link", { name: /sources/i })[0]).toBeDefined();
    expect(screen.getAllByRole("link", { name: /integrations/i })[0]).toBeDefined();
    expect(screen.getAllByRole("link", { name: /reports/i })[0]).toBeDefined();
  });

  it("renders the utility navigation destinations", () => {
    renderShell();

    const utilityNav = screen.getByLabelText("Utility Navigation");
    expect(utilityNav).toBeDefined();

    expect(screen.getAllByRole("link", { name: /settings/i })[0]).toBeDefined();
    expect(screen.getAllByRole("link", { name: /about/i })[0]).toBeDefined();
  });

  it("displays the local sandbox and zero telemetry indicator", () => {
    renderShell();

    expect(screen.getAllByText(/zero telemetry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/local sandbox/i).length).toBeGreaterThan(0);
  });

  it("provides an accessible desktop sidebar and mobile drawer triggers", () => {
    renderShell();

    // Desktop sidebar
    const desktopSidebar = screen.getByLabelText("Desktop Application Sidebar");
    expect(desktopSidebar).toBeDefined();

    // Collapse/Expand button
    const collapseBtn = screen.getByRole("button", { name: /collapse sidebar/i });
    expect(collapseBtn).toBeDefined();

    // Mobile trigger button
    const mobileTrigger = screen.getByRole("button", { name: /open navigation menu/i });
    expect(mobileTrigger).toBeDefined();
  });
});
