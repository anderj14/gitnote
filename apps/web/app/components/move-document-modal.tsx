"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { folderOptions, getParentPath } from "@/app/lib/workspace";
import type { Folder, Note } from "./types";

export function MoveDocumentModal({
  open,
  onOpenChange,
  folders,
  document,
  onMove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: Folder[];
  document: Note | null;
  onMove: (dest: string | null) => void;
}) {
  const options = folderOptions(folders);
  const currentFolder = document ? (getParentPath(document.path) ?? "Root") : "Root";
  const [dest, setDest] = useState<string>(currentFolder);

  useEffect(() => {
    if (open && document) {
      setDest(currentFolder);
    }
  }, [open, document, currentFolder]);

  if (!document) return null;

  const isSame = dest === currentFolder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">Move “{document.name}”</DialogTitle>
          <DialogDescription>Choose a destination folder. The file will keep its name, only the path changes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="label-caps text-muted-foreground">Destination</Label>
          <Select value={dest} onValueChange={setDest}>
            <SelectTrigger className="w-full font-mono text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((loc) => (
                <SelectItem key={loc} value={loc} className="font-mono text-[13px]">
                  {loc} {loc === currentFolder ? "(current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="font-mono text-xs text-muted-foreground">
            {dest === "Root" ? document.name : `${dest}/${document.name}`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onMove(dest === "Root" ? null : dest)} disabled={isSame}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
