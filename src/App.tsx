import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallBanner } from "@/components/InstallBanner";
import { useSettings } from "@/lib/settings";
import AppShell from "@/components/AppShell";
import ScanScreen from "./pages/Scan";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound.tsx";

const HistoryScreen = lazy(() => import("./pages/History"));
const GenerateScreen = lazy(() => import("./pages/Generate"));
const ProfileScreen = lazy(() => import("./pages/Profile"));
const ShareQRScreen = lazy(() => import("./pages/ShareQR"));
const LanguageScreen = lazy(() => import("./pages/Language"));
const PrivacyScreen = lazy(() => import("./pages/Privacy"));

const PageFallback = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
);

const App = () => {
  const onboarded = useSettings((s) => s.onboarded);

  return (
    <ErrorBoundary>
      <TooltipProvider>
          <OfflineBanner />
          <InstallBanner />
          <Sonner position="top-center" />
        <BrowserRouter>
          {!onboarded ? (
            <Routes>
              <Route path="*" element={<Onboarding />} />
            </Routes>
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
                <Route
                  path="/generate"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <GenerateScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ProfileScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="/share-qr"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ShareQRScreen />
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
                </Route>
                <Route
                  path="/privacy"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PrivacyScreen />
                    </Suspense>
                  }
                />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </BrowserRouter>
        </TooltipProvider>
    </ErrorBoundary>
  );
};

export default App;
