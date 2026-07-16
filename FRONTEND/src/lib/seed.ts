import { v4 as uuid } from "uuid";
import { addDays, format, subDays } from "date-fns";
import type { DutySheet, Employee, Train, DutyDay } from "./types";
import { STATUTORY_HOURS, totalDeduction } from "./ot-utils";

const now = () => new Date().toISOString();

const names = [
  ["Ravi Kumar", "Tech-I", "A"], ["Suresh Rao", "Sr.Tech", "A"],
  ["Ganesh Naik", "Tech-II", "B"], ["Manoj Singh", "Tech-III", "B"],
  ["Prakash Gowda", "Asst", "C"], ["Vinod Sharma", "Helper", "C"],
  ["Anil Kumar", "Tech-I", "A"], ["Ramesh Babu", "Sr.Tech", "D"],
  ["Deepak Menon", "Tech-II", "D"], ["Karthik Reddy", "Tech-III", "E"],
  ["Sanjay Patil", "Asst", "E"], ["Rajesh N", "Helper", "F"],
  ["Mohan Das", "Tech-I", "A"], ["Harish Rao", "Sr.Tech", "B"],
  ["Nagaraj K", "Tech-II", "C"], ["Basavaraj S", "Tech-III", "D"],
  ["Praveen T", "Asst", "E"], ["Chandru M", "Helper", "F"],
  ["Kiran V", "Tech-I", "A"], ["Umesh J", "Sr.Tech", "B"],
];

const batches = ["A BATCH", "B BATCH", "RAJDHANI", "SICKLINE/IOH", "VANDE BHARAT"];

export function seedEmployees(): Employee[] {
  return names.map(([name, designation, groupType], i) => ({
    id: uuid(),
    slNo: i + 1,
    name: name as string,
    pfNumber: `275${String(100000 + i * 37).padStart(6, "0")}`,
    tokenNo: `${5000 + i}`,
    designation: designation as string,
    presentBatch: batches[i % batches.length],
    groupType: groupType as any,
    address: "SBC Colony, Bengaluru",
    phone: `98${String(40000000 + i * 12345).slice(0, 8)}`,
    status: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
  }));
}

export function seedTrains(): Train[] {
  const t = (num: string, name: string, category: string): Train => ({
    id: uuid(),
    trainNumber: num,
    trainName: name,
    category,
    status: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
  });
  const list = [
    t("20661", "Vande Bharat SBC-DWR-SBC", "Vande Bharat"),
    t("20662", "Vande Bharat DWR-SBC", "Vande Bharat"),
    t("26651", "Vande Bharat SBC-ERS-SBC", "Vande Bharat"),
    t("26652", "Vande Bharat ERS-SBC", "Vande Bharat"),
    t("22691", "Rajdhani SBC-HNZM", "Rajdhani"),
    t("22692", "Rajdhani HNZM-SBC", "Rajdhani"),
    t("12027", "Shatabdi SBC-MAS", "Shatabdi"),
    t("12028", "Shatabdi MAS-SBC", "Shatabdi"),
  ];
  for (let i = 0; i < list.length; i += 2) {
    list[i].pairedTrainId = list[i + 1].id;
    list[i + 1].pairedTrainId = list[i].id;
  }
  return list;
}

function findNearestPastSunday(d: Date): Date {
  const dow = d.getDay();
  return subDays(d, dow === 0 ? 7 : dow);
}

function buildDays(startISO: string, mut: (i: number, d: DutyDay) => void = () => {}): DutyDay[] {
  const start = new Date(startISO);
  const days: DutyDay[] = [];
  for (let i = 0; i < 14; i++) {
    const dt = addDays(start, i);
    const dayName = format(dt, "EEEE");
    const isRest = dayName === "Sunday";
    const d: DutyDay = {
      date: format(dt, "yyyy-MM-dd"),
      dayName,
      isRestDay: isRest,
      rosteredSlots: isRest ? [] : [{ from: "08:00", to: "16:00" }],
      rosteredHours: isRest ? 0 : 8,
      actualSlots: isRest ? [] : [{ from: "08:00", to: "16:00" }],
      actualHours: isRest ? 0 : 8,
      extraHours: 0,
      description: "",
      leave: "None",
    };
    mut(i, d);
    d.extraHours = Math.round((d.actualHours - d.rosteredHours) * 100) / 100;
    days.push(d);
  }
  return days;
}

function makeSheet(partial: Partial<DutySheet> & { employeeId: string; startISO: string; days: DutyDay[]; trainIds: string[]; isDraft?: boolean }): DutySheet {
  const { employeeId, startISO, days, trainIds, isDraft } = partial;
  const totalActual = days.reduce((a, d) => a + d.actualHours, 0);
  const totalRost = days.reduce((a, d) => a + d.rosteredHours, 0);
  const ded = totalDeduction(days);
  const end = format(addDays(new Date(startISO), 13), "yyyy-MM-dd");
  return {
    id: uuid(),
    employeeId,
    trainIds,
    periodStartDate: startISO,
    periodEndDate: end,
    days,
    totalActualHours: Math.round(totalActual * 100) / 100,
    totalRosteredHours: Math.round(totalRost * 100) / 100,
    statutoryHours: STATUTORY_HOURS,
    deductionHours: ded,
    otPayable: Math.round((totalActual - STATUTORY_HOURS) * 100) / 100,
    isDraft: !!isDraft,
    createdAt: now(),
    updatedAt: now(),
    ...(partial.manualTrainNote ? { manualTrainNote: partial.manualTrainNote } : {}),
  };
}

export function seedDutySheets(employees: Employee[], trains: Train[]): DutySheet[] {
  if (employees.length === 0 || trains.length === 0) return [];
  const sheets: DutySheet[] = [];
  const today = new Date();
  const pastStart = format(findNearestPastSunday(subDays(today, 28)), "yyyy-MM-dd");
  const draftStart = format(findNearestPastSunday(today), "yyyy-MM-dd");

  // PAST sheet for employee[0] — includes a "banked rest day" (worked on Sunday)
  const pastDays = buildDays(pastStart, (i, d) => {
    if (i === 7) {
      // A Sunday (rest) that the employee actually worked
      d.actualSlots = [{ from: "10:00", to: "18:00" }];
      d.actualHours = 8;
    }
    if (i === 3) {
      d.rosteredSlots = [{ from: "14:00", to: "22:00" }];
      d.rosteredHours = 8;
      d.actualSlots = [{ from: "14:00", to: "23:30" }];
      d.actualHours = 9.5;
      d.description = "OT/OL Vande Bharat";
    }
  });
  sheets.push(makeSheet({
    employeeId: employees[0].id,
    startISO: pastStart,
    days: pastDays,
    trainIds: [trains[0].id, trains[1].id],
  }));

  // DRAFT sheet 1
  sheets.push(makeSheet({
    employeeId: employees[1].id,
    startISO: draftStart,
    days: buildDays(draftStart),
    trainIds: [trains[2].id, trains[3].id],
    isDraft: true,
    manualTrainNote: "Emergency relief duty — special train",
  }));
  // DRAFT sheet 2
  sheets.push(makeSheet({
    employeeId: employees[2].id,
    startISO: draftStart,
    days: buildDays(draftStart),
    trainIds: [trains[4].id, trains[5].id],
    isDraft: true,
  }));

  return sheets;
}
