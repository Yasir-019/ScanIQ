import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import IntegrationsScreen from "@/pages/Integrations";
import SourcesScreen from "@/pages/Sources";
import { IntegrationManager } from "@/lib/integrations";
import { useSettings } from "@/lib/settings";

describe("ScanIQ Community — Phase 5: BYOK Integrations", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.getState().set({ apiKeys: {}, sourceToggles: {} });
    vi.restoreAllMocks();
  });

  const renderIntegrations = () => {
    return render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/integrations"]}>
          <IntegrationsScreen />
        </MemoryRouter>
      </TooltipProvider>
    );
  };

  it("1. IntegrationManager manages credentials and masks secrets securely", () => {
    // 1. Initial state
    const vtItemInitial = IntegrationManager.getItem("virustotal");
    expect(vtItemInitial.isConfigured).toBe(false);
    expect(vtItemInitial.status).toBe("not_configured");

    // 2. Save key
    const testKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    IntegrationManager.saveKey("virustotal", testKey);

    const vtItemConnected = IntegrationManager.getItem("virustotal");
    expect(vtItemConnected.isConfigured).toBe(true);
    expect(vtItemConnected.status).toBe("connected");
    expect(vtItemConnected.maskedKey).toBeDefined();
    // Secret should never be stored in plain maskedKey
    expect(vtItemConnected.maskedKey).not.toBe(testKey);
    expect(vtItemConnected.maskedKey?.includes("•")).toBe(true);

    // 3. Remove key
    IntegrationManager.removeKey("virustotal");
    const vtItemRemoved = IntegrationManager.getItem("virustotal");
    expect(vtItemRemoved.isConfigured).toBe(false);
    expect(vtItemRemoved.status).toBe("not_configured");
  });

  it("2. Renders Integrations UI with + Add Integration and supported provider catalog", () => {
    renderIntegrations();

    expect(screen.getByRole("button", { name: /add integration/i })).toBeDefined();
    expect(screen.getByText(/available threat intel providers/i)).toBeDefined();
    expect(screen.getAllByText(/virustotal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/abuseipdb/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/urlscan.io/i).length).toBeGreaterThan(0);
  });

  it("3. Connects a provider via Add Integration dialog", async () => {
    renderIntegrations();

    // Click Add Integration
    const addBtn = screen.getByRole("button", { name: /add integration/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByText(/connect virustotal/i)).toBeDefined();
    expect(screen.getByLabelText(/api key \/ token/i)).toBeDefined();

    // Fill key and submit
    const keyInput = screen.getByPlaceholderText(/64-character hexadecimal/i);
    fireEvent.change(keyInput, {
      target: { value: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" },
    });

    const connectBtn = screen.getByRole("button", { name: /connect & save/i });
    fireEvent.click(connectBtn);

    // Verification in UI
    expect(screen.getAllByText(/configured integrations/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0);
  });

  it("4. Connects seamlessly with Sources intelligence catalog without duplicate state", () => {
    // Add AbuseIPDB key in Integrations
    IntegrationManager.saveKey("abuseipdb", "fake-abuseipdb-key-9999999999999999999999999999");

    // Render Sources screen
    const { unmount } = render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/sources"]}>
          <SourcesScreen />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Switch to Reputation tab
    const repTab = screen.getByRole("tab", { name: /reputation/i });
    fireEvent.click(repTab);

    // AbuseIPDB must show Connected in Sources catalog
    expect(screen.getByText(/abuseipdb threat intelligence/i)).toBeDefined();
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0);

    unmount();
  });
});
