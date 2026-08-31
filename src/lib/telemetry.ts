import { useSettings } from "./settings";
import { redactSecrets } from "./investigation/sanitization";

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
      const envEnabled = import.meta.env.VITE_TELEMETRY_ENABLED === "true";
      return Boolean(state?.telemetryEnabled && envEnabled);
    } catch {
      return false;
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

    const safeMessage = redactSecrets(error.message || String(error));
    const safeStack = error.stack ? redactSecrets(error.stack) : undefined;

    const payload: CrashReport = {
      message: safeMessage,
      stack: safeStack,
      componentStack: componentStack ? redactSecrets(componentStack) : undefined,
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
