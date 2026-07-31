// src/lib/api.ts
import type { Employee, Train, DutySheet, Batch } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const api = {
  // ============ EMPLOYEES ============
  async getEmployees(includeDeleted = false): Promise<Employee[]> {
    const res = await fetch(`${API_BASE}/employees?includeDeleted=${includeDeleted}`);
    if (!res.ok) throw new Error("Failed to fetch employees");
    return res.json();
  },

  async createEmployee(
    data: Omit<Employee, "id" | "slNo" | "createdAt" | "updatedAt" | "isDeleted" | "status"> &
      Partial<Pick<Employee, "status">>,
  ): Promise<Employee> {
    const res = await fetch(`${API_BASE}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create employee");
    }
    return res.json();
  },

  async updateEmployee(id: string, patch: Partial<Employee>): Promise<Employee> {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update employee");
    }
    return res.json();
  },

  async toggleEmployeeStatus(id: string): Promise<Employee> {
    const res = await fetch(`${API_BASE}/employees/${id}/toggle-status`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to toggle employee status");
    }
    return res.json();
  },

  async softDeleteEmployee(id: string): Promise<Employee> {
    const res = await fetch(`${API_BASE}/employees/${id}/soft-delete`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete employee");
    }
    return res.json();
  },

  async restoreEmployee(id: string): Promise<Employee> {
    const res = await fetch(`${API_BASE}/employees/${id}/restore`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to restore employee");
    }
    return res.json();
  },

  // ============ TRAINS ============
  async getTrains(includeDeleted = false): Promise<Train[]> {
    const res = await fetch(`${API_BASE}/trains?includeDeleted=${includeDeleted}`);
    if (!res.ok) throw new Error("Failed to fetch trains");
    return res.json();
  },

  async createTrain(
    data: Omit<Train, "id" | "createdAt" | "updatedAt" | "isDeleted" | "status"> &
      Partial<Pick<Train, "status">>,
  ): Promise<Train> {
    const res = await fetch(`${API_BASE}/trains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create train");
    }
    return res.json();
  },

  async updateTrain(id: string, patch: Partial<Train>): Promise<Train> {
    const res = await fetch(`${API_BASE}/trains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update train");
    }
    return res.json();
  },

  async toggleTrainStatus(id: string): Promise<Train> {
    const res = await fetch(`${API_BASE}/trains/${id}/toggle-status`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to toggle train status");
    }
    return res.json();
  },

  async softDeleteTrain(id: string): Promise<Train> {
    const res = await fetch(`${API_BASE}/trains/${id}/soft-delete`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete train");
    }
    return res.json();
  },

  async restoreTrain(id: string): Promise<Train> {
    const res = await fetch(`${API_BASE}/trains/${id}/restore`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to restore train");
    }
    return res.json();
  },

  // ============ DUTY SHEETS ============
  async getDutySheets(): Promise<DutySheet[]> {
    const res = await fetch(`${API_BASE}/duty-sheets`);
    if (!res.ok) throw new Error("Failed to fetch duty sheets");
    return res.json();
  },

  async getDutySheet(id: string): Promise<DutySheet> {
    const res = await fetch(`${API_BASE}/duty-sheets/${id}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to fetch duty sheet");
    }
    return res.json();
  },

  async saveDutySheet(data: DutySheet): Promise<DutySheet> {
    const res = await fetch(`${API_BASE}/duty-sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to save duty sheet");
    }
    return res.json();
  },

  async deleteDutySheet(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/duty-sheets/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete duty sheet");
    }
  },

  // ============ BATCHES ============

  async findOrCreateBatch(name: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/find-or-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create batch");
    }
    return res.json();
  },

  async getBatches(includeDeleted = false): Promise<Batch[]> {
    const res = await fetch(`${API_BASE}/batches?includeDeleted=${includeDeleted}`);
    if (!res.ok) throw new Error("Failed to fetch batches");
    return res.json();
  },

  async getBatch(id: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${id}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to fetch batch");
    }
    return res.json();
  },

  async saveBatch(data: { id?: string; name: string; days: Batch["days"] }): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to save batch");
    }
    return res.json();
  },

  async deleteEmployee(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/employees/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete employee");
    }
  },

  async softDeleteBatch(id: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${id}/soft-delete`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete batch");
    }
    return res.json();
  },
async deleteBatch(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/batches/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete batch");
  }
},
  async restoreBatch(id: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${id}/restore`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to restore batch");
    }
    return res.json();
  },

// ============ BACKUP FILE/ RESTORE FILE ============

  async getBackup(from?: string, to?: string): Promise<any> {
    const qs = from && to ? `?from=${from}&to=${to}` : "";
    const res = await fetch(`${API_BASE}/backup/export${qs}`);
    if (!res.ok) throw new Error("Failed to export backup");
    return res.json();
  },

  async restoreBackup(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/backup/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to restore backup");
    }
    return res.json();
  },

  // ============ SEED / RESET ============
  async resetDemo(): Promise<{ employees: number; trains: number; dutySheets: number }> {
    const res = await fetch(`${API_BASE}/seed/reset`, {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to reset demo data");
    }
    return res.json();
  },
};
