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

const Onboarding = lazy(() => import("./pages/Onboarding"));
const CasesScreen = lazy(() => import("./pages/Cases"));
const SourcesScreen = lazy(() => import("./pages/Sources"));
const PrivacySettingsScreen = lazy(() => import("./pages/PrivacySettings"));
const InvestigationScreen = lazy(() => import("./pages/Investigation"));
const LanguageScreen = lazy(() => import("./pages/Language"));
const PrivacyScreen = lazy(() => import("./pages/Privacy"));
const TermsScreen = lazy(() => import("./pages/Terms"));
const AboutScreen = lazy(() => import("./pages/About"));
const LicensesScreen = lazy(() => import("./pages/Licenses"));

const PageFallback = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    Loading investigation workspace…
  </div>
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
                  path="/cases"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <CasesScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/sources"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SourcesScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/privacy-settings"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PrivacySettingsScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/investigation/:id"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InvestigationScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/language"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LanguageScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/privacy"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PrivacyScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/terms"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <TermsScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/about"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AboutScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/licenses"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LicensesScreen />
                    </Suspense>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
};

export default App;
