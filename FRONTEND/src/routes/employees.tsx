// src/routes/employees.tsx
// ============================================================
// !EMPLOYEES PAGE - CRUD operations for railway staff
// *Features: List, Search, Filter, Add, Edit, Delete, Restore,
//           Excel Import/Export, Status Toggle

// ============================================
// !Import/Export Improvements
// ============================================
//
//! Key Fixes Made:
// - Improved column matching in `findColumnKey()`:
//   • Exact match (trimmed)
//   • Case-insensitive match
//   • Partial/contains match (e.g. "PF Number" ↔ "PF Number *")
//
//* -Updated Excel download format:
//   • Exported headers now include * for required fields
//   • Matches the official import template
//
//* - Added empty row detection:
//   • Automatically skips completely empty rows during import
//
//* - Improved import feedback:
//   • Displays the number of skipped rows
//   • Provides clearer error messages for invalid data
//
//* Additional Fix:
// - Downloaded Excel template now follows the same format as the import template,
//   including * on all required field headers.
// ============================================
// ============================================================

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useData } from "@/context/DataContext";
import type { Employee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/Combobox";
import { useConfirm } from "@/components/ConfirmProvider";
import { exportSheet } from "@/lib/excel-export";
import { Pencil, Trash2, RotateCcw, Plus, Power, Download, Upload, HelpCircle } from "lucide-react";
import { toast } from "sonner";

// ============================================================
// CONSTANTS - Dropdown options for employee fields
// ============================================================

/** Available designations for railway staff */
const DESIGNATIONS = ["Asst", "Tech-I", "Tech-II", "Tech-III", "Sr.Tech", "Helper"];

/** Available group types (work groups) */
const GROUPS = ["A", "B", "C", "D", "E", "F"];

/** Available batch assignments */
// const BATCHES = ["A BATCH", "B BATCH", "RAJDHANI", "SICKLINE/IOH", "VANDE BHARAT"];

/** Initial empty form state for add/edit dialog */
const emptyForm: Partial<Employee> = {
  name: "",
  pfNumber: "",
  tokenNo: "",
  designation: "Tech-I",
  presentBatch: "",
  groupType: "A",
  address: "",
  phone: "",
  dateOfBirth: "",
  dateOfJoining: "",
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function EmployeesPage() {
  // ============================================================
  // HOOKS & STATE
  // ============================================================

  /** Get data and CRUD functions from context */
  const {
    employees,
    batches,
    addEmployee,
    updateEmployee,
    deleteEmployee, // add
    toggleEmployeeStatus,
    softDeleteEmployee,
    restoreEmployee,
    findOrCreateBatch,
  } = useData();

  /** Confirmation dialog hook */
  const confirm = useConfirm();

  // --- Search & Filter State ---
  const [q, setQ] = useState(""); // Search query
  const [fDesig, setFDesig] = useState<string>("all"); // Filter by designation
  const [fGroup, setFGroup] = useState<string>("all"); // Filter by group
  const [fStatus, setFStatus] = useState<string>("all"); // Filter by status
  const [showArchived, setShowArchived] = useState(false); // Toggle archived view

  // --- Dialog State ---
  const [dialogOpen, setDialogOpen] = useState(false); // Add/Edit dialog visibility
  const [editing, setEditing] = useState<Employee | null>(null); // Employee being edited
  const [form, setForm] = useState<Partial<Employee>>(emptyForm); // Form data
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for submit

  // --- Excel Import ---
  const fileRef = useRef<HTMLInputElement>(null); // Hidden file input ref
  const [helpOpen, setHelpOpen] = useState(false); // Help dialog visibility

  /** Check if any filter is active (for Excel export label) */
  const hasFilter = q.trim() !== "" || fDesig !== "all" || fGroup !== "all" || fStatus !== "all";

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  /**
   * Filter employees based on search query and filters
   * - Excludes archived unless showArchived is true
   * - Searches name, PF number, and token number
   * - Filters by designation, group, and status
   */
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      // Show/hide archived (soft-deleted) employees
      if (showArchived ? !e.isDeleted : e.isDeleted) return false;

      // Search by name, PF number, or token number
      if (
        q &&
        ![e.name, e.pfNumber, e.tokenNo].some((s) => s.toLowerCase().includes(q.toLowerCase()))
      )
        return false;

      // Filter by designation
      if (fDesig !== "all" && e.designation !== fDesig) return false;

      // Filter by group type
      if (fGroup !== "all" && e.groupType !== fGroup) return false;

      // Filter by status (active/inactive)
      if (fStatus !== "all" && e.status !== fStatus) return false;

      return true;
    });
  }, [employees, q, fDesig, fGroup, fStatus, showArchived]);

  // ============================================================
  // DIALOG HANDLERS
  // ============================================================

  /** Open dialog for adding a new employee */
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  /** Open dialog for editing an existing employee */
  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm(e);
    setDialogOpen(true);
  };

  /**
   * Save employee (create or update)
   * - Validates required fields (name, PF number, token)
   * - Calls appropriate API function
   * - Shows success/error toast messages
   */
  const save = async () => {
    // Validate required fields
    if (!form.name || !form.pfNumber || !form.tokenNo) {
      toast.error("Name, PF Number and Token No are required");
      return;
    }

    try {
      setIsSubmitting(true); // Disable button during save

      if (editing) {
        // Update existing employee
        await updateEmployee(editing.id, form);
        toast.success("Employee updated");
      } else {
        // Create new employee
        await addEmployee(form as any);
        toast.success("Employee added");
      }

      setDialogOpen(false); // Close dialog on success
    } catch (err) {
      // Show error message
      toast.error(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  // ============================================================
  // EXCEL EXPORT
  // ============================================================

  /**
   * Download filtered employees as Excel file
   * - Uses the same column format as import template
   * - Includes * for required fields
   */
  const downloadExcel = () => {
    const rows = filtered.map((e) => ({
      "Name *": e.name,
      "PF Number *": e.pfNumber,
      "Token No *": e.tokenNo,
      Designation: e.designation,
      Batch: e.presentBatch,
      Group: e.groupType,
      Phone: e.phone,
      Address: e.address,
      "Date of Birth": e.dateOfBirth || "",
      "Date of Joining": e.dateOfJoining || "",
    }));

    const filename = `employees_${hasFilter ? "filtered" : "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportSheet(rows, filename, "Employees");
    toast.success("Excel downloaded");
  };

  // ============================================================
  // EXCEL IMPORT
  // ============================================================

  /**
   * Import employees from Excel/CSV file
   *
   * SUPPORTED COLUMNS (case-insensitive, flexible matching):
   *   Required: Name, PF Number, Token No
   *   Optional: Designation, Batch, Group, Phone, Address, DOB, DOJ
   *
   * Column matching strategy:
   *   1. Exact match (trimmed)
   *   2. Case-insensitive match
   *   3. Contains match (handles "Name" vs "Name *")
   */
  const handleImportFile = async (file: File) => {
    try {
      // Read the Excel file
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      // Check if file has data
      if (rows.length === 0) {
        toast.error("No rows found in file");
        return;
      }

      /**
       * Find column key in the row using flexible matching
       * @param row - The data row object
       * @param possibleNames - Array of possible column names
       * @returns The actual column key or null
       */
      const findColumnKey = (
        row: Record<string, unknown>,
        possibleNames: string[],
      ): string | null => {
        const keys = Object.keys(row);

        // Strategy 1: Exact match (trimmed)
        for (const name of possibleNames) {
          const exact = keys.find((k) => k.trim() === name);
          if (exact) return exact;
        }

        // Strategy 2: Case-insensitive match
        for (const name of possibleNames) {
          const lowerName = name.toLowerCase();
          const match = keys.find((k) => k.trim().toLowerCase() === lowerName);
          if (match) return match;
        }

        // Strategy 3: Contains match (handles "Name" vs "Name *")
        for (const name of possibleNames) {
          const lowerName = name.toLowerCase();
          const match = keys.find((k) => {
            const lowerKey = k.trim().toLowerCase();
            return lowerKey.includes(lowerName) || lowerName.includes(lowerKey);
          });
          if (match) return match;
        }

        return null;
      };

      /**
       * Get value from row using flexible column matching
       */
      const getValue = (row: Record<string, unknown>, possibleNames: string[]): string => {
        const key = findColumnKey(row, possibleNames);
        if (!key) return "";
        const val = row[key];
        return val ? String(val).trim() : "";
      };

      let added = 0; // Count of successfully imported employees
      let skipped = 0; // Count of skipped rows

      // Process each row
      for (const r of rows) {
        // Skip completely empty rows
        const hasData = Object.values(r).some((v) => v && String(v).trim() !== "");
        if (!hasData) {
          skipped++;
          continue;
        }

        // Extract required fields
        const name = getValue(r, ["Name", "Name *", "Employee Name"]);
        const pfNumber = getValue(r, ["PF Number", "PF Number *", "PF No", "PF", "PF No *"]);
        const tokenNo = getValue(r, ["Token No", "Token No *", "Token", "Token Number"]);

        // Skip if required fields are missing
        if (!name || !pfNumber || !tokenNo) {
          skipped++;
          continue;
        }

        // Extract optional fields with defaults
        const designation = getValue(r, ["Designation"]) || "Tech-I";
        // const importedBatch = getValue(r, ["Batch", "Present Batch"]);

        // const batchExists = batches.some(
        //   (b) => b.name.trim().toLowerCase() === importedBatch.trim().toLowerCase(),
        // );

        // const presentBatch = batchExists ? importedBatch : "";
        const importedBatchRaw = getValue(r, ["Batch", "Present Batch"]);
        let presentBatch = "";
        if (importedBatchRaw.trim()) {
          const created = await findOrCreateBatch(importedBatchRaw.trim());
          presentBatch = created.name; // canonical stored name, avoids case-duplicates
        }
        const groupRaw = getValue(r, ["Group", "Group Type"]) || "A";
        const groupType =
          groupRaw
            .replace(/group\s*/i, "")
            .trim()
            .toUpperCase()
            .slice(0, 1) || "A";

        // Add employee to database via API
        await addEmployee({
          name,
          pfNumber,
          tokenNo,
          designation,
          presentBatch,
          groupType: groupType as any,
          phone: getValue(r, ["Phone", "Mobile"]),
          address: getValue(r, ["Address"]),
          dateOfBirth: getValue(r, ["Date of Birth", "DOB"]),
          dateOfJoining: getValue(r, ["Date of Joining", "DOJ"]),
        });
        added++;
      }

      // Show success message with import stats
      toast.success(`Imported ${added} employee(s)${skipped ? ` · skipped ${skipped}` : ""}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read the Excel file");
    } finally {
      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ============================================================
  // ACTION HANDLERS (with confirmation)
  // ============================================================

  /**
   * Toggle employee status (active ↔ inactive)
   * - Shows confirmation dialog before action
   * - Handles errors and shows toast messages
   */
  const handleToggleStatus = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Toggle status for ${name}?`,
      confirmText: "Toggle",
    });
    if (ok) {
      try {
        await toggleEmployeeStatus(id);
        toast.success("Status toggled");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to toggle status");
      }
    }
  };

  /**
   * Soft delete employee (archive)
   * - Marks as deleted but keeps in database
   * - Can be restored later
   */
  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Permanently delete ${name}?`,
      description:
        "This cannot be undone. This will remove the employee's data from the database completely.",
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) {
      try {
        await deleteEmployee(id);
        toast.success("Employee permanently deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete employee");
      }
    }
  };
  /**
   * Restore archived employee
   * - Sets isDeleted back to false
   */
  const handleRestore = async (id: string) => {
    try {
      await restoreEmployee(id);
      toast.success("Restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore employee");
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-4">
      {/* ========== HEADER ========== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Employees</h1>
          <p className="text-sm text-slate-500">Manage technical staff records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Hidden file input for Excel import */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />

          {/* Action buttons */}
          <Button variant="outline" onClick={downloadExcel}>
            <Download className="h-4 w-4 mr-1" />
            Download Excel {hasFilter ? "(Filtered)" : "(All)"}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import Excel
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            title="Import format"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          {/* <Button variant="outline" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "Show Active" : "Show Archived"}
          </Button> */}
          <Button onClick={openAdd} className="bg-[#0b2545] hover:bg-[#0b2545]/90">
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      {/* ========== IMPORT HELP DIALOG ========== */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Excel — expected format</DialogTitle>
            <DialogDescription>
              Upload an <b>.xlsx</b>, <b>.xls</b>, or <b>.csv</b> file with a header row in the
              first sheet.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <div>Recognised columns (header names, case-insensitive):</div>
            <ul className="list-disc pl-5 text-xs text-slate-700 space-y-0.5">
              <li>
                <b>Name</b> or <b>Name *</b> — required
              </li>
              <li>
                <b>PF Number</b> or <b>PF Number *</b> — required
              </li>
              <li>
                <b>Token No</b> or <b>Token No *</b> — required
              </li>
              <li>
                <b>Designation</b> — e.g. Tech-I, Sr.Tech, Helper
              </li>
              <li>
                <b>Batch</b> — e.g. A BATCH, VANDE BHARAT
              </li>
              <li>
                <b>Group</b> — A / B / C / D / E / F (or "Group A")
              </li>
              <li>
                <b>Phone</b>, <b>Address</b>, <b>Date of Birth</b>, <b>Date of Joining</b> —
                optional
              </li>
            </ul>
            <div className="text-xs text-slate-500">
              Tip: use the <b>Download Excel</b> button first to get an exact template.
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setHelpOpen(false)}
              className="bg-[#0b2545] hover:bg-[#0b2545]/90"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== SEARCH & FILTERS ========== */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search name / token / PF"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Combobox
            value={fDesig}
            onChange={setFDesig}
            options={[
              { value: "all", label: "All Designations" },
              ...DESIGNATIONS.map((d) => ({ value: d, label: d })),
            ]}
            placeholder="Designation"
          />
          <Combobox
            value={fGroup}
            onChange={setFGroup}
            options={[
              { value: "all", label: "All Groups" },
              ...GROUPS.map((g) => ({ value: g, label: `Group ${g}` })),
            ]}
            placeholder="Group"
          />
          <Combobox
            value={fStatus}
            onChange={setFStatus}
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            placeholder="Status"
          />
        </CardContent>
      </Card>

      {/* ========== EMPLOYEE TABLE ========== */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3">Sl</th>
                  <th>Name</th>
                  <th>PF No</th>
                  <th>Token</th>
                  <th>Designation</th>
                  <th>Batch</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th className="text-right pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">{e.slNo}</td>
                    <td className="font-medium">{e.name}</td>
                    <td>{e.pfNumber}</td>
                    <td>{e.tokenNo}</td>
                    <td>{e.designation}</td>
                    <td className="text-slate-600">{e.presentBatch}</td>
                    <td>
                      <Badge variant="outline">Group {e.groupType}</Badge>
                    </td>
                    <td>
                      <Badge className={e.status === "active" ? "bg-emerald-600" : "bg-slate-400"}>
                        {e.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        {showArchived ? (
                          // Show Restore button when viewing archived
                          <Button size="sm" variant="ghost" onClick={() => handleRestore(e.id)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          // Show Edit/Toggle/Archive buttons for active view
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStatus(e.id, e.name)}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(e.id, e.name)}
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ========== ADD/EDIT EMPLOYEE DIALOG ========== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *">
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="PF Number *">
              <Input
                value={form.pfNumber ?? ""}
                onChange={(e) => setForm({ ...form, pfNumber: e.target.value })}
              />
            </Field>
            <Field label="Token No *">
              <Input
                value={form.tokenNo ?? ""}
                onChange={(e) => setForm({ ...form, tokenNo: e.target.value })}
              />
            </Field>
            <Field label="Designation">
              <Combobox
                value={form.designation as string}
                onChange={(v) => setForm({ ...form, designation: v })}
                options={DESIGNATIONS.map((d) => ({ value: d, label: d }))}
              />
            </Field>
            {/* <Field label="Present Batch">
              <Combobox
                value={form.presentBatch as string}
                onChange={(v) => setForm({ ...form, presentBatch: v })}
                options={BATCHES.map((b) => ({ value: b, label: b }))}
              />
            </Field> */}

            <Field label="Present Batch">
              <Combobox
                value={form.presentBatch as string}
                onChange={(v) => setForm({ ...form, presentBatch: v })}
                options={batches.map((b) => ({ value: b.name, label: b.name }))}
                allowCreate
                onCreate={async (name) => {
                  await findOrCreateBatch(name);
                }}
              />
            </Field>
            <Field label="Group Type">
              <Combobox
                value={form.groupType as string}
                onChange={(v) => setForm({ ...form, groupType: v as any })}
                options={GROUPS.map((g) => ({ value: g, label: `Group ${g}` }))}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Address">
              <Input
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={form.dateOfBirth ?? ""}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </Field>
            <Field label="Date of Joining">
              <Input
                type="date"
                value={form.dateOfJoining ?? ""}
                onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={isSubmitting}
              className="bg-[#0b2545] hover:bg-[#0b2545]/90"
            >
              {isSubmitting ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// HELPER COMPONENT
// ============================================================

/**
 * Form field wrapper with label
 * Provides consistent styling for form fields
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
