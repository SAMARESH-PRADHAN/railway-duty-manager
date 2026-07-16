import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DutySheet, Employee, Train } from "./types";
import { fmtDate, fmtHours } from "./ot-utils";

function slotToStr(s: { from: string; to: string }) {
  return `${s.from.replace(":", ".")}:${s.to.replace(":", ".")}`;
}

export function exportOtSlipPdf(sheet: DutySheet, emp: Employee, trains: Train[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  // Header block
  const top = 12;
  doc.setFontSize(10);
  const leftLines = [
    `Station : SSE/C&W/SBC`,
    `Name of the Employee : ${emp.name}`,
    `Token No : ${emp.tokenNo}`,
    `Designation : ${emp.designation}`,
    `PF. No. : ${emp.pfNumber}`,
  ];
  const rightLines = [
    `Total Hours worked : ${fmtHours(sheet.totalActualHours)}`,
    `Actual Rostered Hours : ${fmtHours(sheet.totalRosteredHours)}`,
    `Statutory Hours : 104.00`,
    `Extra Hours worked : ${fmtHours(sheet.totalActualHours - sheet.totalRosteredHours)}`,
    `OT Payable : ${fmtHours(sheet.otPayable)}`,
    `Period From: ${fmtDate(sheet.periodStartDate)}`,
    `Period To: ${fmtDate(sheet.periodEndDate)}`,
  ];
  doc.setFont("helvetica", "normal");
  leftLines.forEach((l, i) => doc.text(l, 14, top + i * 5));
  rightLines.forEach((l, i) => doc.text(l, W / 2 + 5, top + i * 5));

  const titleY = top + Math.max(leftLines.length, rightLines.length) * 5 + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("EMPLOYMENT REGULATING EXTRA HOUR SLIP", W / 2, titleY, { align: "center" });

  // Train pairs lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ty = titleY + 6;
  const paired: Set<string> = new Set();
  const pairs: string[] = [];
  for (const t of trains) {
    if (paired.has(t.id)) continue;
    const p = trains.find((x) => x.id === t.pairedTrainId);
    if (p) {
      paired.add(t.id); paired.add(p.id);
      pairs.push(`To escort ${t.category} ${t.trainName.replace(/-SBC.*/, "-SBC")} (${t.trainNumber}-${p.trainNumber}) Express.`);
    } else {
      paired.add(t.id);
      pairs.push(`To escort ${t.category} ${t.trainName} (${t.trainNumber}) Express.`);
    }
  }
  pairs.forEach((l) => { doc.text(l, 14, ty); ty += 4.5; });
  if (sheet.manualTrainNote) {
    doc.text(`Additional: ${sheet.manualTrainNote}`, 14, ty);
    ty += 4.5;
  }

  // Table
  const body = sheet.days.map((d) => {
    const rostTime = d.isRestDay ? "REST" : d.rosteredSlots.map(slotToStr).join(" / ");
    const actTime = d.isRestDay && d.actualSlots.length === 0 ? "REST" : d.actualSlots.map(slotToStr).join(" / ") || "-";
    return [
      d.dayName.slice(0, 3),
      fmtDate(d.date),
      rostTime,
      d.isRestDay && d.rosteredHours === 0 ? "REST" : fmtHours(d.rosteredHours),
      actTime,
      d.isRestDay && d.actualHours === 0 ? "REST" : fmtHours(d.actualHours),
      fmtHours(d.extraHours),
      d.description || "",
    ];
  });

  autoTable(doc, {
    startY: ty + 2,
    head: [["Day", "Date", "Rostered Timings", "R.Hrs", "Actual Timings", "A.Hrs", "Extra", "Description"]],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [30, 30, 30], lineWidth: 0.15 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255, fontStyle: "bold" },
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 20 }, 2: { cellWidth: 38 },
      3: { cellWidth: 14, halign: "right" }, 4: { cellWidth: 44 },
      5: { cellWidth: 14, halign: "right" }, 6: { cellWidth: 14, halign: "right" },
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Total Actual Hours: ${fmtHours(sheet.totalActualHours)}`, 14, y); y += 5;
  if (sheet.deductionHours > 0) {
    doc.text(`Less Deduction (${sheet.deductionType}): -${fmtHours(sheet.deductionHours)}`, 14, y); y += 5;
  }
  doc.text(`Rostered: ${fmtHours(sheet.totalRosteredHours)}    Actual: ${fmtHours(sheet.totalActualHours)}    OT Payable: ${fmtHours(sheet.otPayable)}`, 14, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Officer-in-charge", 20, y);
  doc.text("SSE-in-charge", W / 2 - 15, y);
  doc.text("Employee Signature", W - 55, y);
  doc.setFont("helvetica", "bold");
  doc.text("SOUTH WESTERN RAILWAY", W - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });

  doc.save(`OT_Slip_${emp.name.replace(/\s+/g, "_")}_${sheet.periodStartDate}.pdf`);
}

export interface ReportRow {
  employee: Employee;
  sheets: DutySheet[];
}

export function exportReportPdf(opts: {
  rows: ReportRow[];
  groupType: string;
  from: string;
  to: string;
  refNo: string;
  date: string;
  body: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SOUTH WESTERN RAILWAY", W / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Reference No: ${opts.refNo}`, 14, 22);
  doc.text(`Date: ${opts.date}`, W - 14, 22, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Office of the Senior Coaching Depot/SBC", W / 2, 28, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text("To,", 14, 38);
  doc.text("Sr. DME/SBC", 14, 43);
  doc.setFont("helvetica", "bold");
  doc.text("Subject: Submission of Vande Bharat, Shatabdi & Rajdhani/OTA Slips.", 14, 51);

  doc.setFont("helvetica", "normal");
  const wrapped = doc.splitTextToSize(opts.body, W - 28);
  doc.text(wrapped, 14, 58);
  let startY = 58 + wrapped.length * 4 + 3;

  const body: any[] = [];
  opts.rows.forEach((r, i) => {
    const periods = r.sheets.map((s) => `${fmtDate(s.periodStartDate)} to ${fmtDate(s.periodEndDate)}`).join("\n");
    const rost = r.sheets.map((s) => fmtHours(s.totalRosteredHours)).join("\n");
    const act = r.sheets.map((s) => fmtHours(s.totalActualHours)).join("\n");
    const stat = r.sheets.map(() => "104.00").join("\n");
    const ot = r.sheets.map((s) => fmtHours(s.otPayable)).join("\n");
    body.push([
      i + 1,
      `${r.employee.name}\n${r.employee.designation} / Token: ${r.employee.tokenNo}\nPF: ${r.employee.pfNumber}`,
      periods, rost, act, stat, ot,
    ]);
  });

  autoTable(doc, {
    startY,
    head: [["Sl.No", "Employee", "Period(s)", "Rostered", "Actual", "Statutory", "OT Payable"]],
    body,
    styles: { fontSize: 8, cellPadding: 1.5, valign: "top", lineColor: [30, 30, 30], lineWidth: 0.15 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
    },
  });

  const y = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Sr. CDO/SBC", 20, y);
  doc.text("SSE/C&W/SBC", W - 20, y, { align: "right" });

  doc.save(`OTA_Report_Group_${opts.groupType}_${opts.from}_${opts.to}.pdf`);
}
