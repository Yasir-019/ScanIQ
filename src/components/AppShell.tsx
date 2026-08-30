import { memo, useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ScanSearch,
  Briefcase,
  DatabaseZap,
  ShieldHalf,
  Info,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const primaryNavItems = [
  { to: "/", labelKey: "nav.scan", fallbackLabel: "Scan & Decode", icon: ScanSearch, end: true },
  { to: "/cases", labelKey: "nav.cases", fallbackLabel: "Cases", icon: Briefcase },
  { to: "/sources", labelKey: "nav.sources", fallbackLabel: "Intelligence Feeds", icon: DatabaseZap },
  { to: "/privacy-settings", labelKey: "nav.settings", fallbackLabel: "Privacy & Controls", icon: ShieldHalf },
];

const AppShell = memo(function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = useMemo(
    () =>
      primaryNavItems.map((item) => ({
        ...item,
        label: t(item.labelKey, item.fallbackLabel),
      })),
    [t],
  );

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Platform Ethos */}
          <div className="flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30 group-hover:border-primary/60 transition-colors">
                <Cpu className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  ScanIQ
                  <span className="text-[10px] font-mono font-normal text-muted-foreground uppercase px-1.5 py-0.2 rounded bg-secondary/80 border border-border">
                    v1.0
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  Defensive OSINT & Barcode Intelligence
                </span>
              </div>
            </NavLink>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Desktop Navigation">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/25 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right Status & About */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-1"
            >
              <ShieldCheck className="h-3 w-3" />
              <span>Zero Telemetry</span>
            </Badge>

            <NavLink
              to="/about"
              className={({ isActive }) =>
                cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
                  isActive && "bg-secondary text-foreground border-primary/40",
                )
              }
              title="About ScanIQ"
              aria-label="About ScanIQ"
            >
              <Info className="h-4 w-4" />
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main Workspace Surface */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 md:py-6 overflow-x-hidden" role="main">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border/80 safe-bottom"
        aria-label="Mobile Navigation"
      >
        <ul className="flex items-stretch justify-around px-2 py-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors focus:outline-none focus-visible:bg-secondary/40 focus-visible:text-primary",
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
                aria-label={label}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg transition-transform",
                        isActive && "bg-primary/15 text-primary scale-110",
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                    </div>
                    <span className="max-w-full truncate">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
});

export default AppShell;
