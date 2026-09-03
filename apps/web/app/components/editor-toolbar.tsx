"use client";

import type { Editor } from "@tiptap/react";
import { LinkDialog } from "./link-dialog";
import { useState } from "react";

type EditorToolbarProps = {
    editor: Editor;
};

type ToolbarButtonProps = {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
};

function ToolbarButton({
    label,
    active = false,
    disabled = false,
    onClick,
}: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`rounded-md px-2.5 py-1.5 text-sm transition ${active
                ? "bg-zinc-200 text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                } ${disabled
                    ? "cursor-not-allowed opacity-30"
                    : "cursor-pointer"
                }`}
        >
            {label}
        </button>
    );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkSelection, setLinkSelection] = useState<{
        from: number;
        to: number;
    } | null>(null);

    return (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 pb-3">
        <ToolbarButton
            label="B"
            active={editor.isActive("bold")}
            onClick={() =>
                editor.chain().focus().toggleBold().run()
            }
        />

            <ToolbarButton
                label="I"
                active={editor.isActive("italic")}
                onClick={() =>
                    editor.chain().focus().toggleItalic().run()
                }
            />

            <ToolbarButton
                label="H1"
                active={editor.isActive("heading", { level: 1 })}
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleHeading({ level: 1 })
                        .run()
                }
            />

            <ToolbarButton
                label="H2"
                active={editor.isActive("heading", { level: 2 })}
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleHeading({ level: 2 })
                        .run()
                }
            />

            <ToolbarButton
                label="H3"
                active={editor.isActive("heading", { level: 3 })}
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleHeading({ level: 3 })
                        .run()
                }
            />

            <div className="mx-1 h-5 w-px bg-zinc-200" />

            <ToolbarButton
                label="• List"
                active={editor.isActive("bulletList")}
                onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                }
            />

            <ToolbarButton
                label="1. List"
                active={editor.isActive("orderedList")}
                onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                }
            />

            <ToolbarButton
                label="Quote"
                active={editor.isActive("blockquote")}
                onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                }
            />

            <ToolbarButton
                label="☑"
                active={editor.isActive("taskList")}
                onClick={() => editor.commands.toggleTaskList()}
            />

            <ToolbarButton
                label="—"
                onClick={() => editor.commands.setHorizontalRule()}
            />

            <ToolbarButton
                label="Code"
                active={editor.isActive("codeBlock")}
                onClick={() =>
                    editor.chain().focus().toggleCodeBlock().run()
                }
            />

            <ToolbarButton
                label="Table"
                onClick={() => {
                    editor.commands.focus();
                    editor.commands.insertTable({
                        rows: 3,
                        cols: 3,
                        withHeaderRow: true,
                    });
                }}
            />

            <ToolbarButton
                label="Link"
                active={editor.isActive("link")}
                onClick={() => {
                    const { from, to } = editor.state.selection;

                    setLinkSelection({ from, to });
                    setLinkDialogOpen(true);
                }}
            />

            <ToolbarButton
                label="Unlink"
                disabled={!editor.isActive("link")}
                onClick={() =>
                    editor.chain().focus().unsetLink().run()
                }
            />

            <div className="mx-1 h-5 w-px bg-zinc-200" />

            <ToolbarButton
                label="↶"
                disabled={!editor.can().undo()}
                onClick={() =>
                    editor.chain().focus().undo().run()
                }
            />

            <ToolbarButton
                label="↷"
                disabled={!editor.can().redo()}
                onClick={() =>
                    editor.chain().focus().redo().run()
                }
            />

            <LinkDialog
                open={linkDialogOpen}
                initialUrl={
                    editor.getAttributes("link").href ?? ""
                }
                onClose={() => setLinkDialogOpen(false)}
                onSubmit={(url) => {
                    if (!linkSelection) {
                        return;
                    }

                    editor
                        .chain()
                        .setTextSelection(linkSelection)
                        .setLink({ href: url })
                        .run();

                    setLinkSelection(null);
                }}
            />
        </div>
    );
}