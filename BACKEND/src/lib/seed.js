const { randomUUID } = require("crypto");
const { addDays, format, subDays } = require("date-fns");
const { recalcSheet } = require("./ot-utils");

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

function buildSeedEmployees() {
  return names.map(([name, designation, groupType], i) => ({
    slNo: i + 1,
    name,
    pfNumber: `275${String(100000 + i * 37).padStart(6, "0")}`,
    tokenNo: `${5000 + i}`,
    designation,
    presentBatch: batches[i % batches.length],
    groupType,
    address: "SBC Colony, Bengaluru",
    phone: `98${String(40000000 + i * 12345).slice(0, 8)}`,
    status: "active",
  }));
}

function buildSeedTrains() {
  const t = (num, name, category) => ({
    id: randomUUID(),
    trainNumber: num,
    trainName: name,
    category,
    status: "active",
    pairedTrainId: null,
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

function findNearestPastSunday(d) {
  const dow = d.getDay();
  return subDays(d, dow === 0 ? 7 : dow);
}

function buildDays(startISO, mut = () => {}) {
  const start = new Date(startISO);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const dt = addDays(start, i);
    const dayName = format(dt, "EEEE");
    const isRest = dayName === "Sunday";
    const d = {
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

function makeSheet({ employeeId, startISO, days, trainIds, isDraft, manualTrainNote }) {
  const recalced = recalcSheet({ days });
  const end = format(addDays(new Date(startISO), 13), "yyyy-MM-dd");
  return {
    employeeId,
    trainIds,
    manualTrainNote: manualTrainNote ?? null,
    periodStartDate: startISO,
    periodEndDate: end,
    days: recalced.days,
    totalActualHours: recalced.totalActualHours,
    totalRosteredHours: recalced.totalRosteredHours,
    statutoryHours: recalced.statutoryHours,
    deductionHours: recalced.deductionHours,
    otPayable: recalced.otPayable,
    isDraft: !!isDraft,
  };
}

function buildSeedDutySheets(employees, trains) {
  if (employees.length === 0 || trains.length === 0) return [];
  const sheets = [];
  const today = new Date();
  const pastStart = format(findNearestPastSunday(subDays(today, 28)), "yyyy-MM-dd");
  const draftStart = format(findNearestPastSunday(today), "yyyy-MM-dd");

  const pastDays = buildDays(pastStart, (i, d) => {
    if (i === 7) {
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

  sheets.push(makeSheet({
    employeeId: employees[1].id,
    startISO: draftStart,
    days: buildDays(draftStart),
    trainIds: [trains[2].id, trains[3].id],
    isDraft: true,
    manualTrainNote: "Emergency relief duty — special train",
  }));

  sheets.push(makeSheet({
    employeeId: employees[2].id,
    startISO: draftStart,
    days: buildDays(draftStart),
    trainIds: [trains[4].id, trains[5].id],
    isDraft: true,
  }));

  return sheets;
}

module.exports = { buildSeedEmployees, buildSeedTrains, buildSeedDutySheets };
