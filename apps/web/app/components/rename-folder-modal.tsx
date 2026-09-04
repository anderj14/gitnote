"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { validateFolderName } from "@/app/lib/workspace";

export function RenameFolderModal({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentName: string;
  onRename: (newName: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  function handleRename() {
    const trimmed = name.trim();
    const v = validateFolderName(trimmed);
    if (v) {
      setError(v);
      return;
    }
    onRename(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">Rename folder</DialogTitle>
          <DialogDescription>Update the folder name. Document paths inside will be updated.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="label-caps text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Current: <span className="font-mono">{currentName}</span></p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleRename}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
