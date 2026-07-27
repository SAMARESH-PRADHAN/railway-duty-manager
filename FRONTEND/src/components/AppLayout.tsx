import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Train as TrainIcon, ClipboardList, FileText, BarChart3, Menu, X, RefreshCw, Calendar, CalendarDays } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmProvider";
import { BackupRestore } from "@/components/BackupRestore";
// import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/trains", label: "Trains", icon: TrainIcon },
  { to: "/duty", label: "Extra Hour Slip", icon: ClipboardList },
  { to: "/records", label: "Duty Records", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
   { to: "/batches", label: "Roster Duty Set", icon: CalendarDays },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // const { resetDemo } = useData();
  // const confirm = useConfirm();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try { localStorage.removeItem("ota:theme"); } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-[#0b2545] text-white px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <TrainIcon className="h-5 w-5" />
          <span className="font-semibold">OTA Manager</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div className="flex">
        <aside className={`${open ? "block" : "hidden"} md:block fixed md:sticky md:top-0 z-20 h-screen w-64 shrink-0 bg-[#0b2545] text-white`}>
          <div className="hidden md:flex items-center gap-2 px-6 py-5 border-b border-white/10">
            <TrainIcon className="h-6 w-6 text-[#f0a500]" />
            <div>
              <div className="font-bold leading-tight">OTA Manager</div>
              <div className="text-[10px] tracking-wider text-white/60">SOUTH WESTERN RAILWAY</div>
            </div>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {nav.map((n) => {
              const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
         <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
  <BackupRestore />
</div>
        </aside>

        <main className="flex-1 min-w-0 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
