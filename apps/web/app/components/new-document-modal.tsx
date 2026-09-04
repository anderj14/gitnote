"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { Folder, Note } from "./types";
import { folderOptions as getFolderOptions } from "@/app/lib/workspace";

const TEMPLATES: Record<string, string> = {
  Blank: "# Untitled\n\n",
  Documentation: "# Documentation\n\n## Overview\n\n",
  "Meeting Notes": "# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n",
  "Technical Design": "# Technical Design\n\n## Context\n\n## Proposal\n\n",
  "YouTube Script": "# YouTube Script\n\n## Hook\n\n## Main Content\n\n",
};

export function NewDocumentModal({
  open,
  onOpenChange,
  folders,
  documents,
  onCreate,
  repoConnected,
  initialFolder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: Folder[];
  documents: Note[];
  onCreate: (note: Note) => void;
  repoConnected: boolean;
  initialFolder?: string | null;
}) {
  const options = getFolderOptions(folders);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState(options[0] ?? "Root");
  const [template, setTemplate] = useState("Blank");

  useEffect(() => {
    if (open) {
      if (initialFolder) {
        // verify it exists, otherwise fallback
        const exists = options.includes(initialFolder);
        setLocation(exists ? initialFolder : (options[0] ?? "Root"));
      } else {
        setLocation(options[0] ?? "Root");
      }
    }
  }, [open, initialFolder, options.join("|")]);

  function handleCreate() {
    const name = title.trim() || "Untitled";
    const fileName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
    const folderPath = location === "Root" ? "" : location;
    const path = folderPath ? `${folderPath}/${fileName}.md` : `${fileName}.md`;
    const id = `local:${Date.now()}:${path}`;
    const content = `${TEMPLATES[template] ?? ""}`.replace("Untitled", name);

    // Check duplicate
    const allPaths = new Set<string>([...documents.map((d) => d.path), ...folders.flatMap((f) => f.documents.map((d) => d.path))]);
    if (allPaths.has(path)) {
      toast.error("A document with that name already exists in this folder.");
      return;
    }

    const note: Note = { id, name: `${name}.md`, path, content };
    onCreate(note);
    onOpenChange(false);
    toast.success(`Created “${name}”`, { description: `${path} · ${template} template${repoConnected ? "" : " · local only"}` });
    setTitle("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-display">Create document</DialogTitle>
          <DialogDescription>A Markdown file{repoConnected ? " — save to commit to GitHub" : " stored locally"}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title" className="label-caps text-muted-foreground">Title</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled document" />
          </div>
          <div className="space-y-1.5">
            <Label className="label-caps text-muted-foreground">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="w-full font-mono text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((loc) => (
                  <SelectItem key={loc} value={loc} className="font-mono text-[13px]">{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-caps text-muted-foreground">Template</Label>
            <div className="grid gap-1 pt-1">
              {Object.keys(TEMPLATES).map((t) => (
                <label key={t} className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] ${template === t ? "border-primary/30 bg-accent" : "border-transparent hover:bg-muted"}`}>
                  <input type="radio" name="template" value={t} checked={template === t} onChange={() => setTemplate(t)} className="size-3.5 accent-primary" />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
