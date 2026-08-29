import { memo, useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ScanLine, FolderSearch, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const tabConfig = [
  { to: "/", labelKey: "nav.scan", icon: ScanLine, end: true },
  { to: "/history", labelKey: "nav.cases", icon: FolderSearch },
  { to: "/profile", labelKey: "nav.settings", icon: SettingsIcon },
];

const AppShell = memo(function AppShell() {
  const { t } = useTranslation();
  const tabs = useMemo(() => tabConfig.map((tab) => ({ ...tab, label: t(tab.labelKey) })), [t]);
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#05080a] md:py-6 md:px-4">
      <div className="flex h-[100dvh] md:h-[88dvh] md:max-h-[850px] w-full max-w-md flex-col bg-background text-foreground shadow-elegant md:rounded-[32px] md:border md:border-border/60 overflow-hidden relative">
        <main className="relative flex-1 overflow-hidden" role="main">
          <Outlet />
        </main>
        <nav
          className="glass safe-bottom z-40 border-t border-border/60"
          aria-label={t("nav.primary", "Primary Navigation")}
        >
          <ul className="flex items-stretch justify-around px-2 pt-1.5">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors focus:outline-none focus-visible:bg-secondary/40 focus-visible:text-primary",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )
                  }
                  aria-label={label}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-transform duration-200",
                          isActive && "scale-110",
                        )}
                        strokeWidth={isActive ? 2.4 : 2}
                        aria-hidden="true"
                      />
                      <span className="max-w-full truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
});

export default AppShell;
