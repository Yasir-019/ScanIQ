import type {
  BaseIntelligenceProvider,
} from "./base";
import type {
  ProviderCapability,
  ProviderContext,
  ProviderStatus,
  RateLimitInfo,
  TargetType,
} from "./types";
import { localHeuristicProvider } from "./base";
import { rdapDomainProvider, rdapIpProvider } from "./rdap-provider";
import { dnsOverHttpsProvider } from "./dns-provider";
import { ipinfoProvider } from "./ip-provider";
import { virusTotalProvider } from "./virustotal-provider";
import { urlscanProvider } from "./urlscan-provider";
import { abuseIpdbProvider } from "./abuseipdb-provider";
import { crtshProvider } from "./crtsh-provider";
import { googleSafeBrowsingProvider } from "./safebrowsing-provider";

export interface ProviderRegistrationInfo {
  provider: BaseIntelligenceProvider;
  registeredAt: number;
}

export interface ProviderHealthSummary {
  providerId: string;
  name: string;
  category: string;
  status: ProviderStatus;
  ready: boolean;
  requiresAuth: boolean;
  capabilities: ProviderCapability[];
  reason?: string;
}

export class RateLimitTracker {
  private static limits = new Map<string, RateLimitInfo>();

  public static recordLimit(providerId: string, info: RateLimitInfo) {
    const existing = this.limits.get(providerId) || {};
    this.limits.set(providerId, {
      ...existing,
      ...info,
      lastChecked: Date.now(),
    });
  }

  public static getLimit(providerId: string): RateLimitInfo | undefined {
    const info = this.limits.get(providerId);
    if (!info) return undefined;

    // Check if resetAt timestamp has expired
    if (info.resetAt && Date.now() > info.resetAt) {
      this.limits.delete(providerId);
      return undefined;
    }

    return info;
  }

  public static isRateLimited(providerId: string): boolean {
    const info = this.getLimit(providerId);
    if (!info) return false;
    return !!info.isExceeded || (info.remaining !== undefined && info.remaining <= 0);
  }

  public static clear(providerId?: string) {
    if (providerId) {
      this.limits.delete(providerId);
    } else {
      this.limits.clear();
    }
  }
}

export class ProviderRegistry {
  private static providers = new Map<string, BaseIntelligenceProvider>();

  static {
    // Register standard intelligence providers
    this.register(localHeuristicProvider);
    this.register(rdapDomainProvider);
    this.register(rdapIpProvider);
    this.register(dnsOverHttpsProvider);
    this.register(ipinfoProvider);
    this.register(virusTotalProvider);
    this.register(urlscanProvider);
    this.register(abuseIpdbProvider);
    this.register(crtshProvider);
    this.register(googleSafeBrowsingProvider);
  }

  /**
   * Registers a provider instance.
   */
  public static register(provider: BaseIntelligenceProvider) {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregisters a provider by ID.
   */
  public static unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Retrieves a registered provider by ID.
   */
  public static get(providerId: string): BaseIntelligenceProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Lists all registered providers.
   */
  public static list(): BaseIntelligenceProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Finds all providers capable of handling a specific target type.
   */
  public static findByTargetType(type: TargetType): BaseIntelligenceProvider[] {
    return this.list().filter((p) => p.supportedTargets.includes(type));
  }

  /**
   * Finds all providers supporting a specific capability.
   */
  public static findByCapability(capability: ProviderCapability): BaseIntelligenceProvider[] {
    return this.list().filter((p) => p.capabilities.includes(capability));
  }

  /**
   * Finds all providers that are currently ready and configured.
   */
  public static findConfigured(context: ProviderContext): BaseIntelligenceProvider[] {
    return this.list().filter((p) => p.checkPrerequisites(context).ready);
  }

  /**
   * Evaluates the current status of a provider against context and rate limits.
   */
  public static getStatus(
    providerId: string,
    context: ProviderContext,
  ): ProviderStatus {
    const provider = this.get(providerId);
    if (!provider) return "disabled";

    if (RateLimitTracker.isRateLimited(providerId)) {
      return "rate_limited";
    }

    const prereq = provider.checkPrerequisites(context);
    return prereq.status;
  }

  /**
   * Returns a complete health summary for all registered providers.
   */
  public static getHealthReport(context: ProviderContext): ProviderHealthSummary[] {
    return this.list().map((provider) => {
      const isRateLimited = RateLimitTracker.isRateLimited(provider.id);
      const prereq = provider.checkPrerequisites(context);
      const status: ProviderStatus = isRateLimited ? "rate_limited" : prereq.status;

      return {
        providerId: provider.id,
        name: provider.name,
        category: provider.category,
        status,
        ready: prereq.ready && !isRateLimited,
        requiresAuth: provider.requiresAuth,
        capabilities: provider.capabilities,
        reason: prereq.reason,
      };
    });
  }
}
