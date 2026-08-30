import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import SourcesScreen from "@/pages/Sources";
import { useSettings } from "@/lib/settings";

describe("ScanIQ Community — Phase 4: Sources Architecture & Intelligence Catalog", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderSources = () => {
    return render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/sources"]}>
          <SourcesScreen />
        </MemoryRouter>
      </TooltipProvider>
    );
  };

  it("renders the summary metrics bar displaying local, network, and integration counts", () => {
    renderSources();

    expect(screen.getByText(/total sources/i)).toBeDefined();
    expect(screen.getByText(/local analysis/i)).toBeDefined();
    expect(screen.getByText(/100% offline/i)).toBeDefined();
    expect(screen.getAllByText(/integrations/i).length).toBeGreaterThan(0);
  });

  it("distinguishes Local only, Direct network, and Key required access badges", () => {
    renderSources();

    expect(screen.getAllByText(/local only/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/direct network/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/key required/i).length).toBeGreaterThan(0);
  });

  it("filters sources across architecture tabs (Local, Network, Reputation)", () => {
    renderSources();

    // Switch to Local tab
    const localTab = screen.getByRole("tab", { name: /local/i });
    fireEvent.click(localTab);

    expect(screen.getByText(/local payload analysis & entropy/i)).toBeDefined();
    expect(screen.getByText(/local url safety & symbology heuristics/i)).toBeDefined();

    // Switch to Reputation tab
    const reputationTab = screen.getByRole("tab", { name: /reputation/i });
    fireEvent.click(reputationTab);

    expect(screen.getByText(/virustotal threat intelligence/i)).toBeDefined();
    expect(screen.getByText(/abuseipdb threat intelligence/i)).toBeDefined();
  });

  it("opens the Source Details dialog with target endpoint and privacy implications", () => {
    renderSources();

    // Click Details on the first source card
    const detailButtons = screen.getAllByRole("button", { name: /details/i });
    fireEvent.click(detailButtons[0]);

    // Modal title & content
    expect(screen.getByText(/analyzed data scopes/i)).toBeDefined();
    expect(screen.getByText(/privacy implications & network visibility/i)).toBeDefined();
    expect(screen.getAllByRole("button", { name: /close/i }).length).toBeGreaterThan(0);
  });

  it("shows 'Configure Key' action for unconfigured reputation sources linking to /integrations", () => {
    // Ensure no API keys configured
    useSettings.getState().set({ apiKeys: {} });
    renderSources();

    // Switch to Reputation tab
    const repTab = screen.getByRole("tab", { name: /reputation/i });
    fireEvent.click(repTab);

    const configureButtons = screen.getAllByRole("button", { name: /configure key/i });
    expect(configureButtons.length).toBeGreaterThan(0);
  });

  it("supports text search across source name, categories, and scopes", () => {
    renderSources();

    const searchInput = screen.getByPlaceholderText(/search sources by name/i);
    fireEvent.change(searchInput, { target: { value: "VirusTotal" } });

    expect(screen.getByText(/virustotal threat intelligence/i)).toBeDefined();
    expect(screen.queryByText(/dns-over-https/i)).toBeNull();
  });
});
