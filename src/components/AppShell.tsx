import { memo, useMemo, useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ScanSearch,
  Briefcase,
  DatabaseZap,
  KeyRound,
  FileText,
  SlidersHorizontal,
  Info,
  ShieldCheck,
  Cpu,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

interface NavItemDef {
  to: string;
  labelKey: string;
  fallbackLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const PRIMARY_NAV_ITEMS: NavItemDef[] = [
  { to: "/", labelKey: "nav.scan", fallbackLabel: "Scan", icon: ScanSearch, end: true },
  { to: "/cases", labelKey: "nav.cases", fallbackLabel: "Cases", icon: Briefcase },
  { to: "/sources", labelKey: "nav.sources", fallbackLabel: "Sources", icon: DatabaseZap },
  { to: "/integrations", labelKey: "nav.integrations", fallbackLabel: "Integrations", icon: KeyRound },
  { to: "/reports", labelKey: "nav.reports", fallbackLabel: "Reports", icon: FileText },
];

const UTILITY_NAV_ITEMS: NavItemDef[] = [
  { to: "/privacy-settings", labelKey: "nav.settings", fallbackLabel: "Settings", icon: SlidersHorizontal },
  { to: "/about", labelKey: "nav.about", fallbackLabel: "About", icon: Info },
];

const AppShell = memo(function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();

  // Desktop sidebar collapse state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("scaniq_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync collapsed state to localStorage
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("scaniq_sidebar_collapsed", String(next));
      } catch {
        // LocalStorage disabled or quota exceeded
      }
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const primaryItems = useMemo(
    () =>
      PRIMARY_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey, item.fallbackLabel),
      })),
    [t],
  );

  const utilityItems = useMemo(
    () =>
      UTILITY_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey, item.fallbackLabel),
      })),
    [t],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ========================================================================= */}
      {/* 1. DESKTOP PERSISTENT LEFT SIDEBAR                                        */}
      {/* ========================================================================= */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-full shrink-0 border-r border-border/70 bg-card/60 backdrop-blur-xl transition-all duration-300 z-30",
          isCollapsed ? "w-[4.75rem]" : "w-64",
        )}
        aria-label="Desktop Application Sidebar"
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border/60 shrink-0">
          <NavLink
            to="/"
            className={cn(
              "flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl overflow-hidden",
              isCollapsed && "mx-auto justify-center",
            )}
            title="ScanIQ Community"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30 group-hover:border-primary/60 transition-colors shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>

            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-foreground truncate">
                    ScanIQ
                  </span>
                  <span className="text-[9px] font-mono font-semibold text-primary uppercase px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    Community
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium truncate">
                  Defensive OSINT & Barcode Intel
                </span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Sidebar Navigation Body (Independently scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-6">
          {/* PRIMARY SECTION */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/70 flex items-center justify-between">
                <span>{t("nav.primary", "Primary")}</span>
              </div>
            ) : (
              <div className="h-px bg-border/40 mx-2 mb-2" />
            )}

            <nav className="space-y-1" aria-label="Primary Navigation">
              {primaryItems.map(({ to, label, icon: Icon, end }) => {
                const navLink = (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isCollapsed ? "justify-center px-0 h-10 w-full" : "w-full",
                        isActive
                          ? "bg-primary/12 text-primary border border-primary/30 font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {!isCollapsed && <span className="truncate flex-1">{label}</span>}

                        {/* Active Pill Indicator */}
                        {isActive && (
                          <div
                            className={cn(
                              "absolute right-1.5 h-2 w-2 rounded-full bg-primary shadow-sm",
                              isCollapsed && "right-1 top-1 h-1.5 w-1.5",
                            )}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={to} delayDuration={100}>
                      <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                      <TooltipContent side="right" className="font-semibold text-xs py-1 px-2.5">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return navLink;
              })}
            </nav>
          </div>

          {/* UTILITY SECTION */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/70 flex items-center justify-between">
                <span>{t("nav.utility", "Utility")}</span>
              </div>
            ) : (
              <div className="h-px bg-border/40 mx-2 mb-2" />
            )}

            <nav className="space-y-1" aria-label="Utility Navigation">
              {utilityItems.map(({ to, label, icon: Icon, end }) => {
                const navLink = (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isCollapsed ? "justify-center px-0 h-10 w-full" : "w-full",
                        isActive
                          ? "bg-primary/12 text-primary border border-primary/30 font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {!isCollapsed && <span className="truncate flex-1">{label}</span>}

                        {/* Active Pill Indicator */}
                        {isActive && (
                          <div
                            className={cn(
                              "absolute right-1.5 h-2 w-2 rounded-full bg-primary shadow-sm",
                              isCollapsed && "right-1 top-1 h-1.5 w-1.5",
                            )}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={to} delayDuration={100}>
                      <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                      <TooltipContent side="right" className="font-semibold text-xs py-1 px-2.5">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return navLink;
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/60 bg-card/40 space-y-2 shrink-0">
          {/* Zero Telemetry Status Pill */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-[11px]">
              <div className="flex items-center gap-2 truncate">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-semibold text-foreground truncate">Local Sandbox</span>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-mono border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0"
              >
                Zero Telemetry
              </Badge>
            </div>
          ) : (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center p-2 rounded-xl bg-secondary/40 border border-border/60 cursor-default">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-semibold">
                Local Sandbox · Zero Telemetry
              </TooltipContent>
            </Tooltip>
          )}

          {/* Collapse / Expand Trigger Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className={cn(
              "w-full h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors",
              isCollapsed ? "justify-center px-0" : "justify-between px-2.5",
            )}
            title={isCollapsed ? t("nav.expand", "Expand Sidebar") : t("nav.collapse", "Collapse Sidebar")}
            aria-label={isCollapsed ? t("nav.expand", "Expand Sidebar") : t("nav.collapse", "Collapse Sidebar")}
          >
            {!isCollapsed ? (
              <>
                <span className="text-[11px] font-medium">{t("nav.collapse", "Collapse Sidebar")}</span>
                <ChevronLeft className="h-4 w-4" />
              </>
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN VIEWPORT & MOBILE APPLICATION HEADER                              */}
      {/* ========================================================================= */}
      <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden bg-background">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-14 px-4 flex items-center justify-between border-b border-border/70 bg-card/80 backdrop-blur-lg shrink-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile Navigation Drawer Sheet */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-border bg-secondary/50 text-foreground hover:bg-secondary"
                  aria-label="Open Navigation Menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>

              <SheetContent side="left" className="w-72 p-0 flex flex-col bg-card border-r border-border">
                {/* Mobile Drawer Header */}
                <div className="h-16 px-5 flex items-center justify-between border-b border-border/70 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">ScanIQ Community</span>
                      <span className="text-[10px] text-muted-foreground">Defensive OSINT Workspace</span>
                    </div>
                  </div>

                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
                      <X className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </div>

                {/* Mobile Drawer Scrollable Nav List */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                  {/* Primary Group */}
                  <div className="space-y-1">
                    <div className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/70">
                      {t("nav.primary", "Primary")}
                    </div>
                    <nav className="space-y-1">
                      {primaryItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-colors",
                              isActive
                                ? "bg-primary/12 text-primary border border-primary/25 font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                            )
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-xs">{label}</span>
                        </NavLink>
                      ))}
                    </nav>
                  </div>

                  {/* Utility Group */}
                  <div className="space-y-1">
                    <div className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/70">
                      {t("nav.utility", "Utility")}
                    </div>
                    <nav className="space-y-1">
                      {utilityItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-colors",
                              isActive
                                ? "bg-primary/12 text-primary border border-primary/25 font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                            )
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-xs">{label}</span>
                        </NavLink>
                      ))}
                    </nav>
                  </div>
                </div>

                {/* Mobile Drawer Footer Status */}
                <div className="p-4 border-t border-border/70 bg-secondary/20 space-y-2 shrink-0">
                  <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-background border border-border/60">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-semibold text-foreground">Zero Telemetry</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">100% Local</span>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Mobile Branding Link */}
            <NavLink to="/" className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">ScanIQ</span>
              <Badge variant="outline" className="text-[9px] font-mono border-primary/30 bg-primary/10 text-primary py-0 px-1.5">
                Community
              </Badge>
            </NavLink>
          </div>

          {/* Right Status Badge */}
          <Badge
            variant="outline"
            className="flex items-center gap-1 text-[10px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-1"
          >
            <ShieldCheck className="h-3 w-3" />
            <span className="hidden xs:inline">Zero Telemetry</span>
          </Badge>
        </header>

        {/* Main Independently Scrollable Workspace Area */}
        <main
          className="flex-1 w-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8"
          role="main"
          id="main-content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
});

export default AppShell;
