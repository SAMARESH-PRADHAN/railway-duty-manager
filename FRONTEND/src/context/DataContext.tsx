import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { v4 as uuid } from "uuid";
import { KEYS, clearAll, readList, writeList } from "@/lib/storage";
import { seedDutySheets, seedEmployees, seedTrains } from "@/lib/seed";
import type { DutySheet, Employee, Train } from "@/lib/types";
import { recalcSheet } from "@/lib/ot-utils";

interface DataCtx {
  employees: Employee[];
  trains: Train[];
  dutySheets: DutySheet[];
  addEmployee: (e: Omit<Employee, "id" | "slNo" | "createdAt" | "updatedAt" | "isDeleted" | "status"> & Partial<Pick<Employee, "status">>) => Employee;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  toggleEmployeeStatus: (id: string) => void;
  softDeleteEmployee: (id: string) => void;
  restoreEmployee: (id: string) => void;
  addTrain: (t: Omit<Train, "id" | "createdAt" | "updatedAt" | "isDeleted" | "status"> & Partial<Pick<Train, "status">>) => Train;
  updateTrain: (id: string, patch: Partial<Train>) => void;
  toggleTrainStatus: (id: string) => void;
  softDeleteTrain: (id: string) => void;
  restoreTrain: (id: string) => void;
  saveDutySheet: (s: DutySheet) => void;
  deleteDutySheet: (id: string) => void;
  resetDemo: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [dutySheets, setDutySheets] = useState<DutySheet[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seeded = readList<string>(KEYS.seeded);
    let emps = readList<Employee>(KEYS.employees);
    let trs = readList<Train>(KEYS.trains);
    let ds = readList<DutySheet>(KEYS.dutysheets);
    if (seeded.length === 0 || emps.length === 0) {
      emps = seedEmployees();
      trs = seedTrains();
      ds = seedDutySheets(emps, trs);
      writeList(KEYS.employees, emps);
      writeList(KEYS.trains, trs);
      writeList(KEYS.dutysheets, ds);
      writeList(KEYS.seeded, ["2"]);
    }
    setEmployees(emps);
    setTrains(trs);
    setDutySheets(ds);
    setReady(true);
  }, []);

  useEffect(() => { if (ready) writeList(KEYS.employees, employees); }, [employees, ready]);
  useEffect(() => { if (ready) writeList(KEYS.trains, trains); }, [trains, ready]);
  useEffect(() => { if (ready) writeList(KEYS.dutysheets, dutySheets); }, [dutySheets, ready]);

  const addEmployee: DataCtx["addEmployee"] = useCallback((e) => {
    const now = new Date().toISOString();
    let created!: Employee;
    setEmployees((prev) => {
      const nextSl = (prev.reduce((m, x) => Math.max(m, x.slNo), 0) || 0) + 1;
      created = {
        id: uuid(), slNo: nextSl, status: e.status ?? "active", isDeleted: false,
        createdAt: now, updatedAt: now, ...e,
      } as Employee;
      return [...prev, created];
    });
    return created;
  }, []);

  const updateEmployee: DataCtx["updateEmployee"] = useCallback((id, patch) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e));
  }, []);
  const toggleEmployeeStatus = useCallback((id: string) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, status: e.status === "active" ? "inactive" : "active", updatedAt: new Date().toISOString() } : e));
  }, []);
  const softDeleteEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, isDeleted: true, updatedAt: new Date().toISOString() } : e));
  }, []);
  const restoreEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, isDeleted: false, updatedAt: new Date().toISOString() } : e));
  }, []);

  const addTrain: DataCtx["addTrain"] = useCallback((t) => {
    const now = new Date().toISOString();
    let created!: Train;
    setTrains((prev) => {
      created = { id: uuid(), status: t.status ?? "active", isDeleted: false, createdAt: now, updatedAt: now, ...t } as Train;
      return [...prev, created];
    });
    return created;
  }, []);
  const updateTrain: DataCtx["updateTrain"] = useCallback((id, patch) => {
    setTrains((prev) => prev.map((t) => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t));
  }, []);
  const toggleTrainStatus = useCallback((id: string) => {
    setTrains((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === "active" ? "inactive" : "active", updatedAt: new Date().toISOString() } : t));
  }, []);
  const softDeleteTrain = useCallback((id: string) => {
    setTrains((prev) => prev.map((t) => t.id === id ? { ...t, isDeleted: true, updatedAt: new Date().toISOString() } : t));
  }, []);
  const restoreTrain = useCallback((id: string) => {
    setTrains((prev) => prev.map((t) => t.id === id ? { ...t, isDeleted: false, updatedAt: new Date().toISOString() } : t));
  }, []);

  const saveDutySheet = useCallback((s: DutySheet) => {
    const recalced = recalcSheet({ ...s, updatedAt: new Date().toISOString() });
    setDutySheets((prev) => {
      const exists = prev.some((d) => d.id === recalced.id);
      return exists ? prev.map((d) => d.id === recalced.id ? recalced : d) : [...prev, recalced];
    });
  }, []);
  const deleteDutySheet = useCallback((id: string) => {
    setDutySheets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const resetDemo = useCallback(() => {
    clearAll();
    const emps = seedEmployees();
    const trs = seedTrains();
    const ds = seedDutySheets(emps, trs);
    writeList(KEYS.employees, emps);
    writeList(KEYS.trains, trs);
    writeList(KEYS.dutysheets, ds);
    writeList(KEYS.seeded, ["2"]);
    setEmployees(emps);
    setTrains(trs);
    setDutySheets(ds);
  }, []);

  const value = useMemo<DataCtx>(() => ({
    employees, trains, dutySheets,
    addEmployee, updateEmployee, toggleEmployeeStatus, softDeleteEmployee, restoreEmployee,
    addTrain, updateTrain, toggleTrainStatus, softDeleteTrain, restoreTrain,
    saveDutySheet, deleteDutySheet, resetDemo,
  }), [employees, trains, dutySheets, addEmployee, updateEmployee, toggleEmployeeStatus, softDeleteEmployee, restoreEmployee, addTrain, updateTrain, toggleTrainStatus, softDeleteTrain, restoreTrain, saveDutySheet, deleteDutySheet, resetDemo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used within DataProvider");
  return v;
}
