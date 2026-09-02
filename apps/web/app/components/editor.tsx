"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useEffect, useState, useRef } from "react";
import { EditorToolbar } from "./editor-toolbar";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { ListKit } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { TableControls } from "./table-controls";

type EditorProps = {
    title: string;
    content: string;
    onTitleChange: (title: string) => void;
    onChange: (content: string) => void;
};

export function Editor({ title, content, onTitleChange, onChange }: EditorProps) {
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
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
        ],
        content,
        contentType: "markdown",
        immediatelyRender: false,

        onUpdate({ editor }) {
            setSaveStatus("saving");

            onChange(editor.getMarkdown());

            if (saveTimeout.current) {
                clearTimeout(saveTimeout.current);
            }

            saveTimeout.current = setTimeout(() => {
                setSaveStatus("saved");
            }, 500);
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

    function handleChange() {
        setSaveStatus("saving");

        onChange(editor?.getMarkdown() ?? "");

        if (saveTimeout.current) {
            clearTimeout(saveTimeout.current);
        }

        saveTimeout.current = setTimeout(() => {
            setSaveStatus("saved");
        }, 500);
    }

    return (
        <div className="w-full max-w-3xl px-8 py-10">
            <div className="mb-6">
                <input
                    type="text"
                    value={title}
                    onChange={
                        (event) => {
                            setSaveStatus("saving");

                            onTitleChange(event.target.value);

                            if (saveTimeout.current) {
                                clearTimeout(saveTimeout.current);
                            }

                            saveTimeout.current = setTimeout(() => {
                                setSaveStatus("saved");
                            }, 500);
                        }
                    }
                    placeholder="Untitled"
                    className="w-full border-none bg-transparent text-4xl font-bold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300"
                />
                <span className="ml-4 whitespace-nowrap text-xs text-zinc-400">
                    {saveStatus === "saving" ? "Saving..." : "✓ Saved"}
                </span>
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