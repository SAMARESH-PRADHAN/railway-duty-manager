import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DutySheet, Employee, Train } from "./types";
import { fmtDate, fmtHours } from "./ot-utils";

function slotToStr(s: { from: string; to: string }) {
  return `${s.from.replace(":", ".")}:${s.to.replace(":", ".")}`;
}

function drawOtSlip(doc: jsPDF, sheet: DutySheet, emp: Employee, trains: Train[]) {
  const W = doc.internal.pageSize.getWidth();
  // Display-only calculation: flat 8-hour deduction, then subtract rostered hours
  const FLAT_DEDUCTION = 8;
  const rawActualSum = sheet.days.reduce((acc, d) => acc + (d.actualHours || 0), 0);
  const displayTotalActual = Math.round((rawActualSum - FLAT_DEDUCTION) * 100) / 100;
  const displayOtPayable = Math.round((displayTotalActual - sheet.totalRosteredHours) * 100) / 100;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("EMPLOYMENT REGULATING EXTRA HOUR SLIP", W / 2, 12, { align: "center" });

  // Header info block
  const top = 19;
  doc.setFontSize(9);
  const leftLabels = ["Station", "Name of the Employee", "Token No", "Designation", "PF. No"];
  const leftValues = ["SSE/C&W/SBC", emp.name, emp.tokenNo, emp.designation, emp.pfNumber];
  const rightLabels = [
    "Total Hours worked",
    "Actual Rostered Hours",
    "Statutory Hours",
    // "Extra Hours worked",
    "OT Payable",
    "Period from",
    "Period to",
  ];
  const rightValues = [
    fmtHours(displayTotalActual), // was sheet.totalActualHours
    fmtHours(sheet.totalRosteredHours),
    fmtHours(sheet.statutoryHours),
    // fmtHours(displayTotalActual - sheet.totalRosteredHours), // was sheet.totalActualHours - sheet.totalRosteredHours
    fmtHours(displayOtPayable), // was sheet.otPayable
    fmtDate(sheet.periodStartDate),
    fmtDate(sheet.periodEndDate),
  ];

  doc.setFont("helvetica", "normal");
  const leftLabelX = 14,
    leftValueX = 52;
  const rightLabelX = W / 2 + 25,
    rightValueX = W - 38;
  leftLabels.forEach((l, i) => {
    doc.text(l, leftLabelX, top + i * 5.5);
    doc.text(`: ${leftValues[i]}`, leftValueX, top + i * 5.5);
  });
  rightLabels.forEach((l, i) => {
    doc.text(l, rightLabelX, top + i * 4.6);
    doc.text(`: ${rightValues[i]}`, rightValueX, top + i * 4.6);
  });

  const afterHeaderY = top + Math.max(leftLabels.length, rightLabels.length) * 5.5 + 3;

  // Escort train lines — one per train, left-aligned, stacked
  const paired: Set<string> = new Set();
  const pairs: string[] = [];
  for (const t of trains) {
    if (paired.has(t.id)) continue;
    const p = trains.find((x) => x.id === t.pairedTrainId);
    if (p) {
      paired.add(t.id);
      paired.add(p.id);
      pairs.push(
        `To escort ${t.trainName.replace(/-SBC.*/, "-SBC")} (${t.trainNumber}/${p.trainNumber}) Express`,
      );
    } else {
      paired.add(t.id);
      pairs.push(`To escort ${t.trainName} (${t.trainNumber}) Express`);
    }
  }
  const escortLines = [...pairs];
  if (sheet.manualTrainNote) escortLines.push(sheet.manualTrainNote);
  const escortText = escortLines.join("\n");

  // Per-day rows
  // const rawActualSum = sheet.days.reduce((acc, d) => acc + (d.actualHours || 0), 0);

  const body = sheet.days.map((d) => {
    const hasRosteredSlots = d.rosteredSlots.length > 0;
    const hasLeave = d.leave && d.leave !== "None";
    const hasActualSlots = d.actualSlots.length > 0;

    // Rostered column: show REST + timing stacked if both are present
    let rostTime: string;
    let rostHours: string;
    if (d.isRestDay && hasRosteredSlots) {
      rostTime = `REST\n${d.rosteredSlots.map(slotToStr).join("\n")}`;
      rostHours = fmtHours(d.rosteredHours);
    } else if (d.isRestDay) {
      rostTime = "REST";
      rostHours = "------";
    } else {
      rostTime = d.rosteredSlots.map(slotToStr).join("\n");
      rostHours = fmtHours(d.rosteredHours);
    }

    // Actual column: show REST + timing stacked if both are present
    let actTime: string;
    let actHours: string;
    const isActualRest = d.actualIsRest;

    const isCR = d.leave === "CR";

    if (hasLeave && hasActualSlots && isCR) {
      actTime = `${d.leave}\n${d.actualSlots.map(slotToStr).join("\n")}`;
      actHours = `------\n${fmtHours(d.actualHours)}`;
    } else if (hasLeave && hasActualSlots) {
      actTime = `${d.leave}\n${d.actualSlots.map(slotToStr).join("\n")}`;
      actHours = fmtHours(d.actualHours);
    } else if (hasLeave) {
      actTime = d.leave as string;
      actHours = isCR ? "------" : fmtHours(d.actualHours);
    } else if (isActualRest && hasActualSlots) {
      actTime = `REST\n${d.actualSlots.map(slotToStr).join("\n")}`;
      actHours = `------\n${fmtHours(d.actualHours)}`;
    } else if (isActualRest) {
      actTime = "REST";
      actHours = "------";
    } else {
      actTime = d.actualSlots.map(slotToStr).join("\n") || "-";
      actHours = fmtHours(d.actualHours);
    }

    const extraDisplay =
      d.extraHours < 0
        ? `(-${fmtHours(Math.abs(d.extraHours))})`
        : d.extraHours > 0
          ? fmtHours(d.extraHours)
          : "";

    return [
      d.dayName.slice(0, 3),
      fmtDate(d.date),
      rostTime,
      rostHours,
      actTime,
      actHours,
      extraDisplay,
      d.description || "",
    ];
  });

 const foot: any[] = [
    ["", "", "", "", "", { content: fmtHours(rawActualSum), styles: { halign: "right" } }, "", ""],
  ];
  foot.push(["", "", "", "", "", { content: `-${fmtHours(FLAT_DEDUCTION)}`, styles: { halign: "right" } }, "", ""]); // always show -08.00
  foot.push([
    { content: "TOTAL", colSpan: 3, styles: { halign: "center", fontStyle: "bold" } },
    { content: fmtHours(sheet.totalRosteredHours), styles: { fontStyle: "bold", halign: "right" } },
    { content: "OT Payable", styles: { fontStyle: "bold", halign: "center" } },
    { content: fmtHours(displayTotalActual), styles: { fontStyle: "bold", halign: "right" } }, // was sheet.totalActualHours
    { content: fmtHours(displayOtPayable), styles: { fontStyle: "bold", halign: "right" } }, // was sheet.otPayable
    "",
  ]);

  autoTable(doc, {
    startY: afterHeaderY,
    head: [
      [
        {
          content: escortText,
          colSpan: 8,
          styles: {
            halign: "left",
            fontStyle: "bold",
            fontSize: 8.5,
            fillColor: 255,
            textColor: 0,
          },
        },
      ],
      [
        { content: "Day", rowSpan: 2 },
        { content: "Date", rowSpan: 2 },
        { content: "Rostered", colSpan: 2, styles: { halign: "center" } },
        { content: "Actual", colSpan: 2, styles: { halign: "center" } },
        { content: "Extra Hours", colSpan: 2, styles: { halign: "center" } },
      ],
      [
  { content: "Timings", styles: { halign: "center" } },
  { content: "Hours", styles: { halign: "center" } },
  { content: "Timings", styles: { halign: "center" } },
  { content: "Hours", styles: { halign: "center" } },
  { content: "Value", styles: { halign: "center" } },
  { content: "Remarks", styles: { halign: "center" } },
]
    ],
    body,
    foot,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.2, right: 1.5, bottom: 2.2, left: 1.5 },
      valign: "middle",
      minCellHeight: 9,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      fillColor: 255,
      textColor: 0,
    },
    headStyles: {
      fillColor: 255,
      textColor: 0,
      fontStyle: "bold",
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      minCellHeight: 8,
    },
    footStyles: {
      fillColor: 255,
      textColor: 0,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      minCellHeight: 8,
    },
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 15, halign: "right" },
      4: { cellWidth: 30 },
      5: { cellWidth: 15, halign: "right" },
      6: { cellWidth: 15, halign: "right" },
      7: { cellWidth: 42 },
    },
    margin: { left: 10, right: 10 },
  });

  let y = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Officer-in-charge", 20, y);
  doc.text("SSE-in-charge", W / 2 - 15, y);
  doc.text("Employee Signature", W - 55, y);

  // doc.save(`OT_Slip_${emp.name.replace(/\s+/g, "_")}_${sheet.periodStartDate}.pdf`);
}

export function exportOtSlipPdf(sheet: DutySheet, emp: Employee, trains: Train[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawOtSlip(doc, sheet, emp, trains);
  doc.save(`OT_Slip_${emp.name.replace(/\s+/g, "_")}_${sheet.periodStartDate}.pdf`);
}

export function exportMultipleOtSlipsPdf(
  items: { sheet: DutySheet; emp: Employee; trains: Train[] }[],
  filenameHint = "OT_Slips_Bulk",
) {
  if (items.length === 0) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  items.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    drawOtSlip(doc, item.sheet, item.emp, item.trains);
  });

  doc.save(`${filenameHint}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
    const periods = r.sheets
      .map((s) => `${fmtDate(s.periodStartDate)} to ${fmtDate(s.periodEndDate)}`)
      .join("\n");
    const rost = r.sheets.map((s) => fmtHours(s.totalRosteredHours)).join("\n");
    const act = r.sheets.map((s) => fmtHours(s.totalActualHours)).join("\n");
    const stat = r.sheets.map(() => "104.00").join("\n");
    const ot = r.sheets.map((s) => fmtHours(s.otPayable)).join("\n");
    body.push([
      i + 1,
      `${r.employee.name}\n${r.employee.designation} / Token: ${r.employee.tokenNo}\nPF: ${r.employee.pfNumber}`,
      periods,
      rost,
      act,
      stat,
      ot,
      "",
      "",
    ]);
  });

  autoTable(doc, {
    startY,
    head: [
      [
        "Sl.No",
        "Employee",
        "Period(s)",
        "Rostered",
        "Actual",
        "Statutory",
        "OT Payable",
        "1½ Times",
        "2 Times",
      ],
    ],
    body,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      valign: "top",
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      fillColor: 255,
      textColor: 0,
    },
    headStyles: {
      fillColor: 255,
      textColor: 0,
      fontStyle: "bold",
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
    },
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 46 },
      2: { cellWidth: 34 },
      3: { halign: "right", cellWidth: 16 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 16 },
      6: { halign: "right", cellWidth: 16 },
      7: { cellWidth: 14 },
      8: { cellWidth: 14 },
    },
    margin: { left: 10, right: 10 },
  });

  const y = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Sr. CDO/SBC", 20, y);
  doc.text("SSE/C&W/SBC", W - 20, y, { align: "right" });

  doc.save(`OTA_Report_Group_${opts.groupType}_${opts.from}_${opts.to}.pdf`);
}
