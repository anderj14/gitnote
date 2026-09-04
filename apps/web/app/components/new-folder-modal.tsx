"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { folderOptions, validateFolderName } from "@/app/lib/workspace";
import type { Folder } from "./types";

export function NewFolderModal({
  open,
  onOpenChange,
  folders,
  onCreate,
  initialParent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: Folder[];
  onCreate: (name: string, parentPath: string | null) => void;
  initialParent?: string | null;
}) {
  const options = folderOptions(folders);
  const [name, setName] = useState("");
  const [parent, setParent] = useState<string>("Root");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setParent(initialParent ?? "Root");
      setName("");
      setError(null);
    }
  }, [open, initialParent]);

  function handleCreate() {
    const trimmed = name.trim();
    const validation = validateFolderName(trimmed);
    if (validation) {
      setError(validation);
      return;
    }
    const parentPath = parent === "Root" ? null : parent;
    // duplicate check handled in workspace.ts but also quick check here
    onCreate(trimmed, parentPath);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">New folder</DialogTitle>
          <DialogDescription>Create a folder in your workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="label-caps text-muted-foreground">Folder name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="e.g. Documentation" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="label-caps text-muted-foreground">Location</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger className="w-full font-mono text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((loc) => (
                  <SelectItem key={loc} value={loc} className="font-mono text-[13px]">{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
