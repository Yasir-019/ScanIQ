import { useSettings } from "@/lib/settings";
import { isConfiguredCredential } from "./config";

export interface CredentialResolution {
  key?: string;
  source: "user_setting" | "environment" | "none";
  isConfigured: boolean;
  masked?: string;
}

export class CredentialStore {
  /**
   * Resolves a provider's credential checking user-configured settings first,
   * then falling back to environment/build configuration.
   * Validates against placeholder patterns (e.g. <CONFIGURE_MANUALLY>).
   */
  public static resolve(envKey?: string, providerId?: string): CredentialResolution {
    if (!envKey && !providerId) {
      return { source: "none", isConfigured: false };
    }

    try {
      const state = useSettings.getState();
      
      // 1. Check user-configured keys in app settings
      if (providerId && isConfiguredCredential(state.apiKeys?.[providerId])) {
        const userKey = state.apiKeys[providerId].trim();
        return {
          key: userKey,
          source: "user_setting",
          isConfigured: true,
          masked: this.mask(userKey),
        };
      }

      if (envKey && isConfiguredCredential(state.apiKeys?.[envKey])) {
        const userKey = state.apiKeys[envKey].trim();
        return {
          key: userKey,
          source: "user_setting",
          isConfigured: true,
          masked: this.mask(userKey),
        };
      }

      // 2. Check environment variable
      if (envKey) {
        const envVal = import.meta.env[envKey] as string | undefined;
        if (isConfiguredCredential(envVal)) {
          const cleanVal = envVal!.trim();
          return {
            key: cleanVal,
            source: "environment",
            isConfigured: true,
            masked: this.mask(cleanVal),
          };
        }
      }
    } catch {
      // Ignore settings access error in non-browser context
    }

    return { source: "none", isConfigured: false };
  }

  /**
   * Checks whether a provider has a valid key configured.
   */
  public static isConfigured(envKey?: string, providerId?: string): boolean {
    return this.resolve(envKey, providerId).isConfigured;
  }

  /**
   * Safely masks a secret string for UI presentation without revealing sensitive content.
   */
  public static mask(secret: string): string {
    if (!secret) return "";
    const len = secret.length;
    if (len <= 6) return "••••••";
    const prefix = secret.slice(0, 3);
    const suffix = secret.slice(-3);
    return `${prefix}${"•".repeat(Math.min(8, Math.max(4, len - 6)))}${suffix}`;
  }

  /**
   * Redacts all known secret values from an error message or log string.
   */
  public static redact(text: string, knownSecrets: string[]): string {
    let result = text;
    for (const sec of knownSecrets) {
      if (sec && sec.length >= 4) {
        result = result.split(sec).join("[REDACTED_API_KEY]");
      }
    }
    return result;
  }
}
