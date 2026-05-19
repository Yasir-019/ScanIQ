import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSettings } from "@/lib/settings";
import AppShell from "@/components/AppShell";
import ScanScreen from "./pages/Scan";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound.tsx";

const HistoryScreen = lazy(() => import("./pages/History"));
const GenerateScreen = lazy(() => import("./pages/Generate"));
const ProfileScreen = lazy(() => import("./pages/Profile"));
const AppShareScreen = lazy(() => import("./pages/AppShare"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
);

const App = () => {
  const { onboarded, theme } = useSettings();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
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
                  path="/share"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AppShareScreen />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
