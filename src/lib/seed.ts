import { v4 as uuid } from "uuid";
import type { Employee, Train } from "./types";

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
  // link pairs
  for (let i = 0; i < list.length; i += 2) {
    list[i].pairedTrainId = list[i + 1].id;
    list[i + 1].pairedTrainId = list[i].id;
  }
  return list;
}
