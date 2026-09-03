"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useEffect } from "react";
import { EditorToolbar } from "./editor-toolbar";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { ListKit } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { TableControls } from "./table-controls";
import { MarkdownPaste } from "./markdown-paste-extension";
import type { SaveStatus } from "./types";

type EditorProps = {
    title: string;
    content: string;
    saveStatus: SaveStatus;
    canSave: boolean;
    onTitleChange: (title: string) => void;
    onChange: (content: string) => void;
    onSave: () => void;
};

function SaveStatusLabel({ status }: { status: SaveStatus }) {
    if (status === "saving") return <span className="text-xs text-zinc-500">Saving...</span>;
    if (status === "unsaved") return <span className="text-xs text-amber-600">Unsaved changes</span>;
    if (status === "error") return <span className="text-xs text-red-600">Failed to save</span>;
    return <span className="text-xs text-zinc-400">✓ Saved</span>;
}

export function Editor({ title, content, saveStatus, canSave, onTitleChange, onChange, onSave }: EditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: false,
                blockquote: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                listKeymap: false,
            }),
            Markdown,
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: "https",
            }),
            Blockquote,
            ListKit.configure({
                taskItem: {
                    nested: true,
                },
            }),
            TableKit.configure({
                table: {
                    resizable: true,
                    cellMinWidth: 80,
                    lastColumnResizable: true,
                },
            }),
            MarkdownPaste,
        ],
        content,
        contentType: "markdown",
        immediatelyRender: false,

        onUpdate({ editor }) {
            onChange(editor.getMarkdown());
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        const currentContent = editor.getMarkdown();

        if (currentContent !== content) {
            editor.commands.setContent(content, {
                contentType: "markdown",
            });
        }
    }, [editor, content]);

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full max-w-5xl px-8 py-10">
            <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => {
                            onTitleChange(event.target.value);
                        }}
                        placeholder="Untitled"
                        className="flex-1 border-none bg-transparent text-4xl font-bold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300"
                    />
                    <div className="flex shrink-0 items-center gap-3">
                        <SaveStatusLabel status={saveStatus} />
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={!canSave || saveStatus === "saving"}
                            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saveStatus === "saving" ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </div>
            <EditorToolbar editor={editor} />
            <div className="pt-6">
                <div className="relative">
                    <EditorContent editor={editor} />
                    <TableControls editor={editor} />
                </div>
            </div>
        </div>
    );
}
