import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useData } from "@/context/DataContext";
import type { Batch } from "@/lib/types";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox } from "@/components/Combobox"; // add import

const createDefaultDays = (): Batch["days"] =>
  Array.from({ length: 14 }, (_, i) => ({
    dayNumber: i + 1,
    isRestDay: false,
    slots: [
      {
        from: "08:00",
        to: "16:00",
      },
    ],
  }));

const BatchesPage = () => {
  const { batches, saveBatch, deleteBatch, refresh, refreshEmployeesSilently, findOrCreateBatch } = useData();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string>();
const [isSaving, setIsSaving] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedNewBatchId, setSelectedNewBatchId] = useState<string>(""); // add
  const filteredBatches = useMemo(() => {
    return batches.filter(
      (b) => b.rosterConfigured && b.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [batches, search]);
  // Batches that exist (e.g. from employee import/form) but have no roster yet.
  const unconfiguredBatches = useMemo(() => batches.filter((b) => !b.rosterConfigured), [batches]);
  const [days, setDays] = useState(createDefaultDays());
// Copies isRestDay + slots from sourceDayNumber into the row at targetIndex.
const copyDayFrom = (targetIndex: number, sourceDayNumber: number) => {
  const source = days.find((d) => d.dayNumber === sourceDayNumber);
  if (!source) return;
  const copy = [...days];
  copy[targetIndex] = {
    ...copy[targetIndex],
    isRestDay: source.isRestDay,
    slots: source.slots.map((s) => ({ ...s })),
  };
  setDays(copy);
  toast.success(`Copied Day ${sourceDayNumber}'s timing into Day ${copy[targetIndex].dayNumber}`);
};
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Roster Duty Set</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-5">
            <Card className="mt-8">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Existing Batches</CardTitle>
                  <Button
                    onClick={() => {
                      setShowForm(true);
                      setEditingId(undefined);
                      setSelectedNewBatchId("");
                      setBatchName("");
                      setDays(createDefaultDays());
                    }}
                    // disabled={unconfiguredBatches.length === 0}
                    // title={
                    //   unconfiguredBatches.length === 0
                    //     ? "No new batches waiting for a roster"
                    //     : undefined
                    // }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Roster Duty
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <Input
                    placeholder="Search batch..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Name</TableHead>

                      <TableHead>Created</TableHead>

                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {batches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-10">
                          No batches found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBatches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell>{batch.name}</TableCell>

                          <TableCell>{new Date(batch.createdAt).toLocaleDateString()}</TableCell>

                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowForm(true);
                                  setEditingId(batch.id);

                                  setBatchName(batch.name);

                                  setDays(structuredClone(batch.days));

                                  window.scrollTo({
                                    top: 0,

                                    behavior: "smooth",
                                  });
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </Button>

                            {/* <Button variant="destructive" size="sm">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Delete "${batch.name}"?`,
                                    description:
                                      "This will permanently delete this roster duty batch and remove it from any employees currently assigned to it. This cannot be undone.",
                                    confirmText: "Delete Permanently",
                                    destructive: true,
                                  });

                                  if (!ok) return;

                                  await deleteBatch(batch.id);
                                  toast.success("Batch permanently deleted");
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </Button> */}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {showForm && (
              <div className="space-y-4">
                <div>
                  <Label>Batch</Label>

                  {editingId ? (
                    <Input
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Example : Batch A"
                    />
                  ) : (
                    <Combobox
                      value={selectedNewBatchId}
                      onChange={(id) => {
                        setSelectedNewBatchId(id);
                        const b = unconfiguredBatches.find((x) => x.id === id);
                        setBatchName(b?.name ?? "");
                      }}
                      options={unconfiguredBatches.map((b) => ({ value: b.id, label: b.name }))}
                      placeholder="Select or type a new batch…"
                      allowCreate
                      onCreate={async (name) => {
                        const created = await findOrCreateBatch(name);
                        setSelectedNewBatchId(created.id); // ✅ select the newly created batch
                        setBatchName(created.name);
                      }}
                    />
                  )}
                </div>
                {days.map((day, index) => (
  <Card key={day.dayNumber}>
    <CardContent className="pt-5">
            <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Day {day.dayNumber}</h3>
          <select
            className="h-7 text-[11px] border rounded px-1 bg-white"
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) copyDayFrom(index, Number(val));
              e.target.value = "";
            }}
          >
            <option value="">Copy from…</option>
            {days
              .filter((d) => d.dayNumber !== day.dayNumber)
              .map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Day {d.dayNumber}
                </option>
              ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={day.isRestDay}
            onCheckedChange={(checked) => {
              const copy = [...days];
              copy[index].isRestDay = !!checked;
              if (checked) {
                copy[index].slots = [];
              } else if (copy[index].slots.length === 0) {
                copy[index].slots = [{ from: "08:00", to: "16:00" }];
              }
              setDays(copy);
            }}
          />
          <Label>Rest Day</Label>

          {/* NEW: Copy to all rows button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const source = days[index];
              const copied = days.map((d) => ({
                ...d,
                isRestDay: source.isRestDay,
                slots: source.slots.map((s) => ({ ...s })),
              }));
              setDays(copied);
              toast.success(`Day ${day.dayNumber}'s timing copied to all rows`);
            }}
          >
            Copy to all rows
          </Button>
        </div>
      </div>
                      {!day.isRestDay && (
                        <div className="space-y-3 mt-5">
                          {day.slots.map((slot, slotIndex) => (
                            <div key={slotIndex} className="grid grid-cols-12 gap-3 items-end">
                              <div className="col-span-5">
                                <Label>From</Label>

                                <Input
                                  type="time"
                                  value={slot.from}
                                  onChange={(e) => {
                                    const copy = [...days];

                                    copy[index].slots[slotIndex].from = e.target.value;

                                    setDays(copy);
                                  }}
                                />
                              </div>

                              <div className="col-span-5">
                                <Label>To</Label>

                                <Input
                                  type="time"
                                  value={slot.to}
                                  onChange={(e) => {
                                    const copy = [...days];

                                    copy[index].slots[slotIndex].to = e.target.value;

                                    setDays(copy);
                                  }}
                                />
                              </div>

                              <div className="col-span-2">
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => {
                                    const copy = [...days];

                                    copy[index].slots.splice(slotIndex, 1);

                                    setDays(copy);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            onClick={() => {
                              const copy = [...days];

                              copy[index].slots.push({
                                from: "08:00",

                                to: "16:00",
                              });

                              setDays(copy);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Slot
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <div className="flex justify-end mt-6">
                  <Button
                  disabled={isSaving}
                    onClick={async () => {
                      const targetId = editingId ?? selectedNewBatchId;
                      if (!targetId) {
                        toast.error("Select a batch first");
                        return;
                      }
                      if (!batchName.trim()) {
                        toast.error("Enter batch name");
                        return;
                      }

                      try {
                          setIsSaving(true);
                        await saveBatch({ id: targetId, name: batchName, days });
                         await refreshEmployeesSilently(); // pulls updated employee.presentBatch after any rename
                        toast.success(
                          editingId
                            ? "Batch updated successfully!"
                            : "Roster duty saved successfully!",
                        );
                        setEditingId(undefined);
                        setSelectedNewBatchId("");
                        setBatchName("");
                        setDays(createDefaultDays());
                        setShowForm(false);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to save batch");
                      } finally {
      setIsSaving(false);
    }
                    }}
                  >
                    {isSaving ? "Saving..." : editingId ? "Update Batch" : "Save Roster Duty"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchesPage;
