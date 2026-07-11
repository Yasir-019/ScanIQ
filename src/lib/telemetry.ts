import { useSettings } from "./settings";

interface LogEvent {
  event: string;
  timestamp: number;
  params?: Record<string, unknown>;
}

interface CrashReport {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: number;
}

const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT || "";
const BUILD_ENV = import.meta.env.MODE || "development";
const VERSION = "1.0.0";

class TelemetryService {
  private isEnabled(): boolean {
    try {
      const state = useSettings.getState();
      return state.telemetryEnabled && import.meta.env.VITE_TELEMETRY_ENABLED !== "false";
    } catch {
      return true;
    }
  }

  async trackEvent(eventName: string, params?: Record<string, unknown>) {
    if (!this.isEnabled()) return;

    const payload: LogEvent = {
      event: eventName,
      timestamp: Date.now(),
      params: {
        ...params,
        env: BUILD_ENV,
        version: VERSION,
      },
    };

    console.log(`[Telemetry Event] ${eventName}:`, payload);

    if (ENDPOINT && navigator.onLine) {
      try {
        await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Fail silently
      }
    }
  }

  async trackCrash(error: Error, componentStack?: string) {
    if (!this.isEnabled()) return;

    const payload: CrashReport = {
      message: error.message || String(error),
      stack: error.stack,
      componentStack,
      timestamp: Date.now(),
    };

    console.error("[Telemetry Crash]:", payload);

    if (ENDPOINT && navigator.onLine) {
      try {
        await fetch(`${ENDPOINT}/crash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            env: BUILD_ENV,
            version: VERSION,
          }),
        });
      } catch {
        // Fail silently
      }
    }
  }
}

export const telemetry = new TelemetryService();
