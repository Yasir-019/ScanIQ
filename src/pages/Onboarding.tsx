import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings";
import { ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const slides = [
  {
    icon: ScanLine,
    title: "Scan anything, instantly",
    body: "QR codes, product barcodes, Wi-Fi cards — all detected in milliseconds.",
  },
  {
    icon: Sparkles,
    title: "Smart actions",
    body: "Open links, save contacts, connect to Wi-Fi, and ask AI to explain what you scanned.",
  },
  {
    icon: ShieldCheck,
    title: "Stay safe",
    body: "We flag suspicious links before you tap. Your scan history stays on your device.",
  },
];

export default function Onboarding() {
  const complete = useSettings((s) => s.completeOnboarding);
  const [i, setI] = useState(0);
  const slide = slides[i];
  const Icon = slide.icon;

  const next = () => {
    if (i < slides.length - 1) setI(i + 1);
    else complete();
  };

  return (
    <div className="flex h-full flex-col bg-gradient-dark px-6 pb-10 pt-16 text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col items-center will-change-transform"
          >
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-primary text-primary-foreground shadow-elegant">
              <Icon className="h-14 w-14" strokeWidth={1.6} />
            </div>
            <h1 className="mb-3 max-w-xs text-3xl font-bold tracking-tight">{slide.title}</h1>
            <p className="max-w-sm text-base text-muted-foreground">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="space-y-5">
        <div className="flex justify-center gap-2">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
        <Button onClick={next} size="lg" className="h-14 w-full rounded-2xl text-base">
          {i < slides.length - 1 ? "Continue" : "Start scanning"}
        </Button>
        {i < slides.length - 1 && (
          <button
            onClick={complete}
            className="block w-full text-center text-sm text-muted-foreground"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
