"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { validateDocumentName, ensureMarkdownSuffix } from "@/app/lib/workspace";

export function RenameDocumentModal({
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
    const raw = name.trim();
    if (!raw) {
      setError("Document name is required.");
      return;
    }
    const withMd = ensureMarkdownSuffix(raw);
    const v = validateDocumentName(withMd);
    if (v) {
      setError(v);
      return;
    }
    onRename(withMd);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">Rename document</DialogTitle>
          <DialogDescription>Change the filename. The .md extension will be added if missing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="label-caps text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="My Document.md" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }} />
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
