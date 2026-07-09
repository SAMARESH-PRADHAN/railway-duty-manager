import { createFileRoute, Link } from "@tanstack/react-router";
import { useData } from "@/context/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Train as TrainIcon, ClipboardList, Clock } from "lucide-react";
import { fmtDate, fmtHours } from "@/lib/ot-utils";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { employees, trains, dutySheets } = useData();
  const activeEmp = employees.filter((e) => !e.isDeleted && e.status === "active").length;
  const activeTrn = trains.filter((t) => !t.isDeleted && t.status === "active").length;
  const now = new Date();
  const monthSheets = dutySheets.filter((d) => {
    const dt = new Date(d.createdAt);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  });
  const totalOt = monthSheets.reduce((a, d) => a + d.otPayable, 0);

  const stats = [
    { label: "Active Employees", value: activeEmp, icon: Users, color: "bg-blue-500" },
    { label: "Active Trains", value: activeTrn, icon: TrainIcon, color: "bg-emerald-500" },
    { label: "Duty Sheets (this month)", value: monthSheets.length, icon: ClipboardList, color: "bg-amber-500" },
    { label: "OT Payable (this month)", value: fmtHours(totalOt), icon: Clock, color: "bg-rose-500" },
  ];

  const recent = [...dutySheets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Dashboard</h1>
        <p className="text-sm text-slate-500">Overtime & Attendance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg text-white grid place-items-center ${s.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 truncate">{s.label}</div>
                  <div className="text-xl font-bold text-slate-800">{s.value}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Duty Sheets</CardTitle>
          <Link to="/records" className="text-sm text-blue-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              No duty sheets yet.{" "}
              <Link to="/duty" className="text-blue-600 hover:underline">Generate New OT</Link>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 border-b">
                  <tr><th className="py-2">Employee</th><th>Period</th><th className="text-right">Actual</th><th className="text-right">OT Payable</th></tr>
                </thead>
                <tbody>
                  {recent.map((s) => {
                    const e = employees.find((x) => x.id === s.employeeId);
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{e?.name ?? "Unknown"}</td>
                        <td className="text-slate-600">{fmtDate(s.periodStartDate)} – {fmtDate(s.periodEndDate)}</td>
                        <td className="text-right">{fmtHours(s.totalActualHours)}</td>
                        <td className="text-right font-semibold text-emerald-700">{fmtHours(s.otPayable)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
