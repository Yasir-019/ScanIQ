import type {
  DomainIntelligence,
  DnsRecord,
  HostIntelligence,
  RedirectChain,
  ReputationResult,
} from "@/lib/scan/types";
import type { OsintSource } from "./sources";

export interface SourceToggleState {
  enabled: Record<string, boolean>;
  authEnv: Record<string, string>;
}

export interface IntelligenceRunner {
  runDns(fqdn: string, opts: { toggles: SourceToggleState; signal?: AbortSignal }): Promise<DnsRecord[]>;
  runRdapDomain(domain: string, opts: { toggles: SourceToggleState; signal?: AbortSignal }): Promise<DomainIntelligence>;
  runHostIntel(ip: string, opts: { toggles: SourceToggleState; signal?: AbortSignal }): Promise<HostIntelligence>;
  runRedirectChain(url: string, opts: { toggles: SourceToggleState; signal?: AbortSignal }): Promise<RedirectChain | undefined>;
  runReputation(params: {
    domain?: string;
    ip?: string;
    url?: string;
    toggles: SourceToggleState;
    signal?: AbortSignal;
  }): Promise<ReputationResult[]>;
  isSourceEnabled(src: OsintSource, toggles: SourceToggleState): boolean;
}

export class NoopIntelligenceRunner implements IntelligenceRunner {
  isSourceEnabled(src: OsintSource, toggles: SourceToggleState): boolean {
    if (!toggles.enabled[src.id]) return false;
    if (src.requiresAuth && src.envKey) {
      const key = toggles.authEnv[src.envKey];
      return !!key && key.length > 0;
    }
    return true;
  }

  async runDns(): Promise<DnsRecord[]> {
    return [];
  }

  async runRdapDomain(_domain: string): Promise<DomainIntelligence> {
    return {
      nameservers: [],
      dns: [],
      statuses: [],
      whoisRedacted: true,
      rdapSource: "rdap.org",
    };
  }

  async runHostIntel(): Promise<HostIntelligence> {
    return {};
  }

  async runRedirectChain(): Promise<RedirectChain | undefined> {
    return undefined;
  }

  async runReputation(): Promise<ReputationResult[]> {
    return [];
  }
}

export const defaultRunner: IntelligenceRunner = new NoopIntelligenceRunner();
