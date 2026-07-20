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
  const { batches, saveBatch, softDeleteBatch } = useData();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string>();

  const [batchName, setBatchName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  }, [batches, search]);

  const [days, setDays] = useState(createDefaultDays());

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
                      setBatchName("");
                      setDays(createDefaultDays());
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Batch
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

                            <Button variant="destructive" size="sm">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Delete "${batch.name}"?`,
                                    description:
                                      "This batch will be archived and can be restored later.",
                                    confirmText: "Delete",
                                    destructive: true,
                                  });

                                  if (!ok) return;

                                  await softDeleteBatch(batch.id);

                                  toast.success("Batch deleted successfully!");
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </Button>
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
              <Label>Batch Name</Label>

              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Example : Batch A"
              />
            </div>
                {days.map((day, index) => (
                  <Card key={day.dayNumber}>
                    <CardContent className="pt-5">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">Day {day.dayNumber}</h3>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={day.isRestDay}
                            onCheckedChange={(checked) => {
                              const copy = [...days];

                              copy[index].isRestDay = !!checked;

                              if (checked) {
                                copy[index].slots = [];
                              } else if (copy[index].slots.length === 0) {
                                copy[index].slots = [
                                  {
                                    from: "08:00",

                                    to: "16:00",
                                  },
                                ];
                              }

                              setDays(copy);
                            }}
                          />

                          <Label>Rest Day</Label>
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
                    onClick={async () => {
                      if (!batchName.trim()) {
                        alert("Enter batch name");

                        return;
                      }

                      await saveBatch({
                        id: editingId,

                        name: batchName,

                        days,
                      });

                      toast.success(
                        editingId ? "Batch updated successfully!" : "Batch created successfully!",
                      );

                      setEditingId(undefined);

                      setBatchName("");

                      setDays(createDefaultDays());
                      setShowForm(false);
                    }}
                  >
                    {editingId ? "Update Batch" : "Save Batch"}
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
