import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScanContentType } from "./scan/types";

/**
 * Default primary actions per content type.
 * The learning system can override these if the user
 * performs an alternative action 3+ more times.
 */
const DEFAULT_PRIMARY: Record<ScanContentType, string> = {
  url: "open_url",
  wifi: "copy_password",
  vcard: "save_contact",
  email: "send_email",
  sms: "send_sms",
  phone: "call",
  geo: "open_maps",
  product: "copy",
  text: "copy",
  payment: "open_payment",
};

/** All possible actions per content type (for ranking) */
const TYPE_ACTIONS: Record<ScanContentType, string[]> = {
  url: ["open_url", "copy", "share"],
  wifi: ["copy_password", "copy", "share"],
  vcard: ["save_contact", "copy", "share"],
  email: ["send_email", "copy", "share"],
  sms: ["send_sms", "copy", "share"],
  phone: ["call", "copy", "share"],
  geo: ["open_maps", "copy", "share"],
  product: ["copy", "share"],
  text: ["copy", "translate", "share"],
  payment: ["open_payment", "copy", "share"],
};

interface ActionStatsState {
  counts: Record<string, number>;
  /** Record an action the user took */
  record: (action: string) => void;
  /** Get the recommended primary action for a content type */
  topAction: (type: ScanContentType) => string;
}

export const useActionStats = create<ActionStatsState>()(
  persist(
    (set, get) => ({
      counts: {},

      record: (action: string) =>
        set((s) => ({
          counts: { ...s.counts, [action]: (s.counts[action] || 0) + 1 },
        })),

      topAction: (type: ScanContentType) => {
        const { counts } = get();
        const actions = TYPE_ACTIONS[type] || [];
        const defaultAction = DEFAULT_PRIMARY[type] || actions[0] || "copy";

        if (actions.length === 0) return defaultAction;

        const defaultCount = counts[defaultAction] || 0;

        // Find the most-used action for this type
        let best = defaultAction;
        let bestCount = defaultCount;
        for (const a of actions) {
          const c = counts[a] || 0;
          // Only override default if alternative has 3+ more uses
          if (a !== defaultAction && c > bestCount && c >= defaultCount + 3) {
            best = a;
            bestCount = c;
          }
        }
        return best;
      },
    }),
    { name: "scaniq-action-stats" },
  ),
);
