import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallBanner } from "@/components/InstallBanner";
import { useSettings } from "@/lib/settings";
import AppShell from "@/components/AppShell";
import ScanScreen from "./pages/Scan";
import NotFound from "./pages/NotFound.tsx";
import { telemetry } from "@/lib/telemetry";

// Lazy-loaded routes — code-split for faster initial load
const Onboarding = lazy(() => import("./pages/Onboarding"));
const HistoryScreen = lazy(() => import("./pages/History"));
const ProfileScreen = lazy(() => import("./pages/Profile"));
const LanguageScreen = lazy(() => import("./pages/Language"));
const PrivacyScreen = lazy(() => import("./pages/Privacy"));
const TermsScreen = lazy(() => import("./pages/Terms"));
const AboutScreen = lazy(() => import("./pages/About"));
const LicensesScreen = lazy(() => import("./pages/Licenses"));

const PageFallback = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
);

const App = () => {
  const onboarded = useSettings((s) => s.onboarded);

  useEffect(() => {
    telemetry.trackEvent("app_launch", { onboarded });
  }, [onboarded]);

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <OfflineBanner />
        <InstallBanner />
        <Sonner position="top-center" />
        <BrowserRouter>
          {!onboarded ? (
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="*" element={<Onboarding />} />
              </Routes>
            </Suspense>
          ) : (
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<ScanScreen />} />
                <Route
                  path="/history"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <HistoryScreen />
                    </Suspense>
                  }
                />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
};

export default App;
