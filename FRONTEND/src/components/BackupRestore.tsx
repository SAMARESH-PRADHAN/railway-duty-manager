import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmProvider";
import { useData } from "@/context/DataContext";
import { api } from "@/lib/api";
import { buildBackupWorkbook, parseBackupWorkbook } from "@/lib/backup-excel";
import { DatabaseBackup, DatabaseZap } from "lucide-react";
import { toast } from "sonner";

export function BackupRestore() {
  const { refresh } = useData();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [backupOpen, setBackupOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const runBackup = async () => {
    try {
      setBusy(true);
      const data = await api.getBackup(from || undefined, to || undefined);
      const wb = buildBackupWorkbook(data);
      const rangeLabel = from && to ? `${from}_to_${to}` : "all";
      XLSX.writeFile(wb, `OTA_Backup_${rangeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Backup downloaded");
      setBackupOpen(false);
      setFrom(""); setTo("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseBackupWorkbook(buf);

      const ok = await confirm({
        title: "Restore this backup?",
        description:
          "Your CURRENT data (all employees, trains, batches, and duty sheets) will be permanently removed and replaced with the data from this backup file. This cannot be undone.",
        confirmText: "Yes, Replace Everything",
        destructive: true,
      });
      if (!ok) return;

      await api.restoreBackup(parsed);
      await refresh();
      toast.success("Backup restored successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleRestoreFile(f);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white"
        onClick={() => setBackupOpen(true)}
      >
        <DatabaseBackup className="h-3 w-3 mr-2" /> Backup Data
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="w-full bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white"
        onClick={() => fileRef.current?.click()}
      >
        <DatabaseZap className="h-3 w-3 mr-2" /> Restore Data
      </Button>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Backup Data</DialogTitle>
            <DialogDescription>
              Optionally pick a date range to back up only duty sheets within that period.
              Leave both empty to back up everything.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={runBackup} className="bg-[#0b2545] hover:bg-[#0b2545]/90">
              {busy ? "Preparing…" : "Download Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}