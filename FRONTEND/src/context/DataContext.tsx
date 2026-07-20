// src/context/DataContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { v4 as uuid } from "uuid";
import { api } from "@/lib/api";
import type { DutySheet, Employee, Train, Batch } from "@/lib/types";
import { recalcSheet } from "@/lib/ot-utils";

interface DataCtx {
  employees: Employee[];
  trains: Train[];
  dutySheets: DutySheet[];
  loading: boolean;
  error: string | null;
  addEmployee: (e: Omit<Employee, "id" | "slNo" | "createdAt" | "updatedAt" | "isDeleted" | "status"> & Partial<Pick<Employee, "status">>) => Promise<Employee>;
  updateEmployee: (id: string, patch: Partial<Employee>) => Promise<void>;
  toggleEmployeeStatus: (id: string) => Promise<void>;
  softDeleteEmployee: (id: string) => Promise<void>;
  restoreEmployee: (id: string) => Promise<void>;
  addTrain: (t: Omit<Train, "id" | "createdAt" | "updatedAt" | "isDeleted" | "status"> & Partial<Pick<Train, "status">>) => Promise<Train>;
  updateTrain: (id: string, patch: Partial<Train>) => Promise<void>;
  toggleTrainStatus: (id: string) => Promise<void>;
  softDeleteTrain: (id: string) => Promise<void>;
  restoreTrain: (id: string) => Promise<void>;
  saveDutySheet: (s: DutySheet) => Promise<void>;
  deleteDutySheet: (id: string) => Promise<void>;
  batches: Batch[];
  saveBatch: (data: { id?: string; name: string; days: Batch["days"] }) => Promise<Batch>;
  softDeleteBatch: (id: string) => Promise<void>;
  restoreBatch: (id: string) => Promise<void>;
  resetDemo: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [dutySheets, setDutySheets] = useState<DutySheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
const [batches, setBatches] = useState<Batch[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [emps, trs, ds, bts] = await Promise.all([
        api.getEmployees(),
        api.getTrains(),
        api.getDutySheets(),
        api.getBatches(),
      ]);
      setEmployees(emps);
      setTrains(trs);
      setDutySheets(ds);
      setBatches(bts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // ============ EMPLOYEE OPERATIONS ============
  const addEmployee: DataCtx["addEmployee"] = useCallback(async (e) => {
    const created = await api.createEmployee(e);
    setEmployees((prev) => [...prev, created]);
    return created;
  }, []);

  const updateEmployee: DataCtx["updateEmployee"] = useCallback(async (id, patch) => {
    const updated = await api.updateEmployee(id, patch);
    setEmployees((prev) => prev.map((e) => e.id === id ? updated : e));
  }, []);

  const toggleEmployeeStatus: DataCtx["toggleEmployeeStatus"] = useCallback(async (id) => {
    const updated = await api.toggleEmployeeStatus(id);
    setEmployees((prev) => prev.map((e) => e.id === id ? updated : e));
  }, []);

  const softDeleteEmployee: DataCtx["softDeleteEmployee"] = useCallback(async (id) => {
    const updated = await api.softDeleteEmployee(id);
    setEmployees((prev) => prev.map((e) => e.id === id ? updated : e));
  }, []);

  const restoreEmployee: DataCtx["restoreEmployee"] = useCallback(async (id) => {
    const updated = await api.restoreEmployee(id);
    setEmployees((prev) => prev.map((e) => e.id === id ? updated : e));
  }, []);

  // ============ TRAIN OPERATIONS ============
  const addTrain: DataCtx["addTrain"] = useCallback(async (t) => {
    const created = await api.createTrain(t);
    setTrains((prev) => [...prev, created]);
    return created;
  }, []);

  const updateTrain: DataCtx["updateTrain"] = useCallback(async (id, patch) => {
    const updated = await api.updateTrain(id, patch);
    setTrains((prev) => prev.map((t) => t.id === id ? updated : t));
  }, []);

  const toggleTrainStatus: DataCtx["toggleTrainStatus"] = useCallback(async (id) => {
    const updated = await api.toggleTrainStatus(id);
    setTrains((prev) => prev.map((t) => t.id === id ? updated : t));
  }, []);

  const softDeleteTrain: DataCtx["softDeleteTrain"] = useCallback(async (id) => {
    const updated = await api.softDeleteTrain(id);
    setTrains((prev) => prev.map((t) => t.id === id ? updated : t));
  }, []);

  const restoreTrain: DataCtx["restoreTrain"] = useCallback(async (id) => {
    const updated = await api.restoreTrain(id);
    setTrains((prev) => prev.map((t) => t.id === id ? updated : t));
  }, []);

  // ============ BATCH OPERATIONS ============
  const saveBatch: DataCtx["saveBatch"] = useCallback(async (data) => {
    const saved = await api.saveBatch(data);
    setBatches((prev) => {
      const exists = prev.some((b) => b.id === saved.id);
      return exists ? prev.map((b) => (b.id === saved.id ? saved : b)) : [...prev, saved];
    });
    return saved;
  }, []);

  const softDeleteBatch: DataCtx["softDeleteBatch"] = useCallback(async (id) => {
    const updated = await api.softDeleteBatch(id);
    setBatches((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }, []);

  const restoreBatch: DataCtx["restoreBatch"] = useCallback(async (id) => {
    const updated = await api.restoreBatch(id);
    setBatches((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }, []);

  // ============ DUTY SHEET OPERATIONS ============
  const saveDutySheet: DataCtx["saveDutySheet"] = useCallback(async (s) => {
    const recalced = recalcSheet({ ...s, updatedAt: new Date().toISOString() });
    const saved = await api.saveDutySheet(recalced);
    setDutySheets((prev) => {
      const exists = prev.some((d) => d.id === saved.id);
      return exists ? prev.map((d) => d.id === saved.id ? saved : d) : [...prev, saved];
    });
  }, []);

  const deleteDutySheet: DataCtx["deleteDutySheet"] = useCallback(async (id) => {
    await api.deleteDutySheet(id);
    setDutySheets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // ============ RESET ============
  const resetDemo: DataCtx["resetDemo"] = useCallback(async () => {
    await api.resetDemo();
    await loadData();
  }, [loadData]);

  const value = useMemo<DataCtx>(() => ({
    employees,
    trains,
    dutySheets,
    batches, 
    loading,
    error,
    addEmployee,
    updateEmployee,
    toggleEmployeeStatus,
    softDeleteEmployee,
    restoreEmployee,
    addTrain,
    updateTrain,
    toggleTrainStatus,
    softDeleteTrain,
    restoreTrain,
    saveDutySheet,
    deleteDutySheet,
    saveBatch,        // <-- new
    softDeleteBatch,  // <-- new
    restoreBatch,
    resetDemo,
    refresh,
  }), [
    employees,
    trains,
    dutySheets,
    batches, 
    loading,
    error,
    addEmployee,
    updateEmployee,
    toggleEmployeeStatus,
    softDeleteEmployee,
    restoreEmployee,
    addTrain,
    updateTrain,
    toggleTrainStatus,
    softDeleteTrain,
    restoreTrain,
    saveDutySheet,
    deleteDutySheet,
     saveBatch,        // <-- new
    softDeleteBatch,  // <-- new
    restoreBatch,
    resetDemo,
    refresh,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used within DataProvider");
  return v;
}