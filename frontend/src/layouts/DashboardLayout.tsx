import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings2,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useAuth } from "../auth/AuthProvider";
import { NotificationBell } from "../components/NotificationBell";

export function DashboardLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const simulatorEnabled =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_SIMULATOR !== "false" &&
    Boolean(user?.roles.includes("admin"));

  const isOnContracts = location.pathname === "/contracts" || location.pathname === "/contracts/";

  return (
    <div className="dash-shell">
      {/* ── SIDEBAR ── */}
      <aside className="dash-sidebar">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-teal-600/20 to-amber-500/20 ring-1 ring-black/[0.06]">
            <Zap className="size-4 text-teal-700" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-stone-800">MASSAI</p>
            <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Consumer</p>
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Navigation */}
        <div className="px-3 pt-4 pb-1">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
            Navigation
          </p>
        </div>

        <ScrollArea className="flex-1 px-2 py-1">
          <nav aria-label="Dashboard navigation" className="grid gap-1">
            <NavLink
              className={({ isActive }) =>
                cn("dash-nav-item", isActive && "dash-nav-item--active")
              }
              end
              to="/contracts"
            >
              <FileText className="size-4" />
              <span>Contracts</span>
            </NavLink>

            {simulatorEnabled ? (
              <NavLink
                className={({ isActive }) =>
                  cn("dash-nav-item", isActive && "dash-nav-item--active")
                }
                to="/admin"
              >
                <Settings2 className="size-4" />
                <span>Operations</span>
              </NavLink>
            ) : null}
          </nav>
        </ScrollArea>

        {/* Session Info */}
        <div className="border-t border-black/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100">
              <span className="text-xs font-bold uppercase text-stone-500">
                {(user?.name ?? user?.email ?? "U").charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">
                {user?.email ?? user?.name ?? "Unknown"}
              </p>
              <p className="truncate text-xs text-stone-400">
                {user?.roles.join(", ") || "no roles"}
              </p>
            </div>
            <Button
              className="size-7 shrink-0 text-stone-400 hover:text-stone-800/60"
              onClick={() => void logout()}
              size="icon-xs"
              title="Logout"
              variant="ghost"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="dash-main">
        {/* ── TOPBAR ── */}
        <header className="dash-topbar">
          <div className="flex items-center gap-3">
            {isOnContracts ? (
              <h1 className="text-sm font-semibold text-stone-800">Contracts</h1>
            ) : (
              <nav className="flex items-center gap-1.5 text-sm">
                <NavLink className="text-stone-400 transition hover:text-stone-800" end to="/contracts">
                  Contracts
                </NavLink>
                <span className="text-stone-300">/</span>
                <span className="font-medium text-stone-800">Detail</span>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
