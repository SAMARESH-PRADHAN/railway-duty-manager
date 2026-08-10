import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";

function ManagedList({
  title, items, onAdd, onRename, onDelete,
}: {
  title: string;
  items: { id: string; name: string }[];
  onAdd: (name: string) => Promise<any>;
  onRename: (id: string, name: string) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
}) {
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await onAdd(newName.trim());
      setNewName("");
      toast.success(`${title} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    }
  };

  const saveRename = async (id: string) => {
    if (!editValue.trim()) return;
    try {
      await onRename(id, editValue.trim());
      setEditingId(null);
      toast.success("Updated — existing employees' records were also updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const remove = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      description: "This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await onDelete(id);
      toast.success("Deleted");
    } catch (err) {
      // This surfaces the backend's "N employees use this" 409 message
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={`New ${title.toLowerCase()}…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center py-6 text-slate-500">None yet</TableCell></TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {editingId === item.id ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename(item.id)}
                      autoFocus
                    />
                  ) : (
                    item.name
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {editingId === item.id ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => saveRename(item.id)}><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(item.id); setEditValue(item.name); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(item.id, item.name)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function DesignationGroupManagementPage() {
  const {
    designations, groupTypes,
    findOrCreateDesignation, updateDesignationName, deleteDesignationById,
    findOrCreateGroupType, updateGroupTypeName, deleteGroupTypeById,
  } = useData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Designation & Group Management</h1>
        <p className="text-sm text-slate-500">Manage designations and group types used across employees</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManagedList
          title="Designation"
          items={designations}
          onAdd={findOrCreateDesignation}
          onRename={updateDesignationName}
          onDelete={deleteDesignationById}
        />
        <ManagedList
          title="Group Type"
          items={groupTypes}
          onAdd={findOrCreateGroupType}
          onRename={updateGroupTypeName}
          onDelete={deleteGroupTypeById}
        />
      </div>
    </div>
  );
}