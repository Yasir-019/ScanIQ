import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings";
import { ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const slideKeys = [
  { icon: ScanLine, titleKey: "onboarding.slide1Title", bodyKey: "onboarding.slide1Body" },
  { icon: Sparkles, titleKey: "onboarding.slide2Title", bodyKey: "onboarding.slide2Body" },
  { icon: ShieldCheck, titleKey: "onboarding.slide3Title", bodyKey: "onboarding.slide3Body" },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const complete = useSettings((s) => s.completeOnboarding);
  const [i, setI] = useState(0);
  const slide = slideKeys[i];
  const Icon = slide.icon;

  const next = () => {
    if (i < slideKeys.length - 1) setI(i + 1);
    else complete();
  };

  return (
    <div className="flex h-full min-h-[90vh] flex-col justify-between max-w-md mx-auto px-6 pb-10 pt-16 text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-primary text-primary-foreground shadow-elegant">
              <Icon className="h-14 w-14" strokeWidth={1.6} />
            </div>
            <h1 className="mb-3 max-w-xs text-3xl font-bold tracking-tight">{t(slide.titleKey)}</h1>
            <p className="max-w-sm text-base text-muted-foreground">{t(slide.bodyKey)}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="space-y-5">
        <div className="flex justify-center gap-2">
          {slideKeys.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
        <Button onClick={next} size="lg" className="h-14 w-full rounded-2xl text-base">
          {i < slideKeys.length - 1 ? t("common.continue") : t("onboarding.start")}
        </Button>
        {i < slideKeys.length - 1 && (
          <button
            onClick={complete}
            className="block w-full text-center text-sm text-muted-foreground"
          >
            {t("common.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
