import { NavLink, Outlet } from "react-router-dom";
import { ScanLine, History as HistoryIcon, QrCode, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Scan", icon: ScanLine, end: true },
  { to: "/history", label: "History", icon: HistoryIcon },
  { to: "/generate", label: "Generate", icon: QrCode },
  { to: "/profile", label: "Profile", icon: User },
];

export default function AppShell() {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <Outlet />
      </main>
      <nav
        className="glass safe-bottom z-40 border-t border-border/60"
        aria-label="Primary"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform",
                        isActive && "scale-110",
                      )}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
