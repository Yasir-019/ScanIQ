import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

export default function AppShareScreen() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const appUrl = "https://scaniq.app/download"; // Placeholder URL

  useEffect(() => {
    QRCode.toDataURL(appUrl, {
      width: 1024,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then(setQrDataUrl);
  }, [appUrl]);

  const handleCopy = async () => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        // Fallback for older browsers or restricted environments
        const textArea = document.createElement("textarea");
        textArea.value = appUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!successful) throw new Error("execCommand copy failed");
      }
      
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard error:", err);
      toast.error("Please copy the link manually from the box below.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ScanIQ App",
          text: "The fastest QR & Barcode scanner with AI insights!",
          url: appUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Sharing failed");
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const downloadLink = document.createElement("a");
    downloadLink.href = qrDataUrl;
    downloadLink.download = "scaniq-app-qr.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success("QR Code saved to gallery");
  };

  return (
    <div className="safe-top flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center px-4 py-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="ml-2 text-xl font-bold">Share App</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-sm space-y-8 text-center">
          {/* App Info */}
          <div className="space-y-2">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-elegant">
              <span className="text-2xl font-bold">IQ</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">ScanIQ Pro</h2>
            <p className="text-sm text-muted-foreground">
              Share the experience with your friends and family
            </p>
          </div>

          {/* QR Code Container */}
          <div className="relative mx-auto flex aspect-square w-full max-w-[280px] flex-col items-center justify-center rounded-[2.5rem] border border-border bg-card p-8 shadow-card">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="App QR Code"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="h-48 w-48 animate-pulse rounded-xl bg-muted" />
            )}
            <div className="absolute -bottom-3 rounded-full bg-primary px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg">
              Scan to download
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button 
              variant="outline" 
              className="h-14 flex-col gap-1 rounded-3xl border-border bg-card shadow-sm"
              onClick={handleDownloadQR}
            >
              <Download className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Save QR</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-14 flex-col gap-1 rounded-3xl border-border bg-card shadow-sm"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Share Link</span>
            </Button>
          </div>

          {/* Link Display */}
          <div className="relative mt-4 flex items-center justify-between gap-2 overflow-hidden rounded-2xl border border-border bg-muted/50 p-1 pl-4">
            <span className="truncate text-xs text-muted-foreground">{appUrl}</span>
            <Button 
              size="sm" 
              className="h-9 rounded-xl px-4"
              onClick={handleCopy}
            >
              {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
