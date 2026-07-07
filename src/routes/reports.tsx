import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Printer } from "lucide-react";
import { fmtDate, fmtHours, periodsOverlap } from "@/lib/ot-utils";
import { exportReportPdf, type ReportRow } from "@/lib/pdf-export";
import { format } from "date-fns";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const GROUPS = ["A", "B", "C", "D", "E", "F"];

function ReportsPage() {
  const { employees, trains, dutySheets } = useData();
  const [train, setTrain] = useState<string>("all");
  const [group, setGroup] = useState<string>("A");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refNo, setRefNo] = useState(`No.65/Raj/Shatabdi/VB/OTA/${new Date().getFullYear()}`);
  const [date, setDate] = useState(format(new Date(), "dd.MM.yyyy"));
  const [body, setBody] = useState("");
  const [generated, setGenerated] = useState(false);

  const rows: ReportRow[] = useMemo(() => {
    if (!generated) return [];
    return employees
      .filter((e) => !e.isDeleted && e.groupType === group)
      .map((e) => {
        const sheets = dutySheets.filter((s) =>
          s.employeeId === e.id &&
          (train === "all" || s.trainIds.includes(train)) &&
          (!from || !to || periodsOverlap(s.periodStartDate, s.periodEndDate, from, to))
        );
        return { employee: e, sheets };
      })
      .filter((r) => r.sheets.length > 0);
  }, [employees, dutySheets, group, train, from, to, generated]);

  const generate = () => {
    setBody(`With reference to the above cited letter the OT Slips in favor of Group '${group}' staff of SSE/C&W/O/SBC for the period ${from ? fmtDate(from) : "—"} to ${to ? fmtDate(to) : "—"}, is enclosed for further necessary action please. As per current OTA sanction limits, the enclosed slips are submitted for approval.`);
    setGenerated(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Train-wise / Group-wise Report</h1>
        <p className="text-sm text-slate-500">Summary of OT slips for a group of employees within a period</p>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs">Train</Label>
          <Select value={train} onValueChange={setTrain}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trains</SelectItem>
              {trains.filter((t) => !t.isDeleted).map((t) => <SelectItem key={t.id} value={t.id}>{t.trainNumber} — {t.trainName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Group Type</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>Group {g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end"><Button className="w-full bg-[#0b2545] hover:bg-[#0b2545]/90" onClick={generate}>Generate</Button></div>
      </CardContent></Card>

      {generated && (
        <>
          <Card><CardHeader><CardTitle className="text-base">Covering Letter</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Reference No</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} /></div>
              <div><Label className="text-xs">Date</Label><Input value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="md:col-span-2"><Label className="text-xs">Body</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Results — Group {group} ({rows.length} employee{rows.length === 1 ? "" : "s"})</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                <Button size="sm" className="bg-[#0b2545] hover:bg-[#0b2545]/90"
                  onClick={() => exportReportPdf({ rows, groupType: group, from, to, refNo, date, body })}>
                  <FileDown className="h-4 w-4 mr-1" /> Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                    <tr>
                      <th className="p-3">Sl</th><th>Employee</th><th>Period(s)</th>
                      <th className="text-right">Rostered</th><th className="text-right">Actual</th>
                      <th className="text-right">Statutory</th><th className="text-right pr-3">OT Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.employee.id} className="border-t align-top">
                        <td className="p-3">{i + 1}</td>
                        <td>
                          <div className="font-semibold">{r.employee.name}</div>
                          <div className="text-xs text-slate-500">{r.employee.designation} / Token: {r.employee.tokenNo}</div>
                          <div className="text-xs text-slate-500">PF: {r.employee.pfNumber}</div>
                        </td>
                        <td className="whitespace-pre-line">{r.sheets.map((s) => `${fmtDate(s.periodStartDate)} to ${fmtDate(s.periodEndDate)}`).join("\n")}</td>
                        <td className="text-right whitespace-pre-line">{r.sheets.map((s) => fmtHours(s.totalRosteredHours)).join("\n")}</td>
                        <td className="text-right whitespace-pre-line">{r.sheets.map((s) => fmtHours(s.totalActualHours)).join("\n")}</td>
                        <td className="text-right whitespace-pre-line">{r.sheets.map(() => "104.00").join("\n")}</td>
                        <td className="text-right whitespace-pre-line font-bold text-emerald-700">{r.sheets.map((s) => fmtHours(s.otPayable)).join("\n")}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No duty sheets in Group {group} match the filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
