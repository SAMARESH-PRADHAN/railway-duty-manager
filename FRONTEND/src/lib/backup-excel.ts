import * as XLSX from "xlsx";

export function buildBackupWorkbook(data: {
  employees: any[]; trains: any[]; batches: any[]; dutySheets: any[];
}) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.employees), "Employees");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.trains), "Trains");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(data.batches.map((b) => ({ ...b, days: JSON.stringify(b.days) }))),
    "Batches",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.dutySheets.map((s) => ({
        ...s,
        trainIds: JSON.stringify(s.trainIds),
        days: JSON.stringify(s.days),
      })),
    ),
    "DutySheets",
  );

  return wb;
}

export function parseBackupWorkbook(buf: ArrayBuffer) {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetJson = (name: string) => {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" }) : [];
  };

  return {
    employees: sheetJson("Employees"),
    trains: sheetJson("Trains"),
    batches: sheetJson("Batches").map((b) => ({ ...b, days: b.days ? JSON.parse(b.days) : [] })),
    dutySheets: sheetJson("DutySheets").map((s) => ({
      ...s,
      trainIds: s.trainIds ? JSON.parse(s.trainIds) : [],
      days: s.days ? JSON.parse(s.days) : [],
    })),
  };
}