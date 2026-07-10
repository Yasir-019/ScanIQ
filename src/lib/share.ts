import { toast } from "sonner";
import { APP_SHARE_MESSAGE, APP_SHARE_TITLE, APP_SHARE_URL } from "./app-meta";
import i18n from "@/lib/i18n";

export async function shareApp() {
  const data = { title: APP_SHARE_TITLE, text: APP_SHARE_MESSAGE, url: APP_SHARE_URL };
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (e) {
      // user cancelled or share failed — fall through to clipboard
      if ((e as DOMException)?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(APP_SHARE_URL);
    toast.success(i18n.t("errors.linkCopied"));
  } catch {
    toast.error(i18n.t("errors.shareFallback") + APP_SHARE_URL);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareImageBlob(blob: Blob, filename: string, title?: string) {
  try {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    if (
      typeof navigator !== "undefined" &&
      navigator.canShare?.({ files: [file] }) &&
      navigator.share
    ) {
      await navigator.share({ files: [file], title: title || filename, text: APP_SHARE_MESSAGE });
      return;
    }
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return;
  }
  downloadBlob(blob, filename);
  toast.success(i18n.t("errors.imageSaved"));
}
