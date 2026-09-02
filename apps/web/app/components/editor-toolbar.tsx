"use client";

import type { Editor } from "@tiptap/react";

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
            className={`rounded-md px-2.5 py-1.5 text-sm transition ${
                active
                    ? "bg-zinc-200 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            } ${
                disabled
                    ? "cursor-not-allowed opacity-30"
                    : "cursor-pointer"
            }`}
        >
            {label}
        </button>
    );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
    return (
        <div className="flex items-center gap-1 border-b border-zinc-200 pb-3">
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
                label="Code"
                active={editor.isActive("codeBlock")}
                onClick={() =>
                    editor.chain().focus().toggleCodeBlock().run()
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
        </div>
    );
}