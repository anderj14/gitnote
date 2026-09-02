"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

type TablePosition = {
    cell: HTMLElement;
    table: HTMLTableElement;
};

type TableControlsProps = {
    editor: Editor | null;
};

const DETECTION_DISTANCE = 35;

export function TableControls({ editor }: TableControlsProps) {
    const [position, setPosition] = useState<TablePosition | null>(null);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const editorElement = editor.view.dom;

        function getClosestCell(mouseX: number, mouseY: number) {
            const cells = Array.from(
                editorElement.querySelectorAll("td, th"),
            );

            let closestCell: HTMLElement | null = null;
            let closestDistance = Infinity;

            for (const element of cells) {
                const cell = element as HTMLElement;
                const rect = cell.getBoundingClientRect();

                const closestX = Math.max(
                    rect.left,
                    Math.min(mouseX, rect.right),
                );

                const closestY = Math.max(
                    rect.top,
                    Math.min(mouseY, rect.bottom),
                );

                const distance = Math.sqrt(
                    Math.pow(mouseX - closestX, 2) +
                    Math.pow(mouseY - closestY, 2),
                );

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCell = cell;
                }
            }

            if (
                closestCell &&
                closestDistance <= DETECTION_DISTANCE
            ) {
                return closestCell;
            }

            return null;
        }

        function handleMouseMove(event: MouseEvent) {
            const cell = getClosestCell(
                event.clientX,
                event.clientY,
            );

            if (!cell) {
                return;
            }

            const table = cell.closest("table");

            if (!(table instanceof HTMLTableElement)) {
                return;
            }

            setPosition({
                cell,
                table,
            });
        }

        editorElement.addEventListener(
            "mousemove",
            handleMouseMove,
        );

        return () => {
            editorElement.removeEventListener(
                "mousemove",
                handleMouseMove,
            );
        };
    }, [editor]);

    if (!editor || !position) {
        return null;
    }

    const cellRect = position.cell.getBoundingClientRect();
    const tableRect = position.table.getBoundingClientRect();

    function selectCell() {
        const pos = editor.view.posAtDOM(position.cell, 0);

        editor.commands.setTextSelection(pos);
    }

    function addColumn() {
        selectCell();
        editor.commands.addColumnAfter();
    }

    function deleteColumn() {
        selectCell();
        editor.commands.deleteColumn();
    }

    function addRow() {
        selectCell();
        editor.commands.addRowAfter();
    }

    function deleteRow() {
        selectCell();
        editor.commands.deleteRow();
    }

    const buttonClass =
        "flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700";

    return (
        <>
            {/* Column controls */}
            <div
                className="pointer-events-auto fixed z-50 flex gap-1"
                style={{
                    left:
                        cellRect.left +
                        cellRect.width / 2 -
                        26,
                    top: tableRect.top - 30,
                }}
            >
                <button
                    type="button"
                    className={buttonClass}
                    title="Add column"
                    onMouseDown={(event) =>
                        event.preventDefault()
                    }
                    onClick={addColumn}
                >
                    +
                </button>

                <button
                    type="button"
                    className={buttonClass}
                    title="Delete column"
                    onMouseDown={(event) =>
                        event.preventDefault()
                    }
                    onClick={deleteColumn}
                >
                    −
                </button>
            </div>

            {/* Row controls */}
            <div
                className="pointer-events-auto fixed z-50 flex flex-col gap-1"
                style={{
                    left: tableRect.left - 30,
                    top:
                        cellRect.top +
                        cellRect.height / 2 -
                        26,
                }}
            >
                <button
                    type="button"
                    className={buttonClass}
                    title="Add row"
                    onMouseDown={(event) =>
                        event.preventDefault()
                    }
                    onClick={addRow}
                >
                    +
                </button>

                <button
                    type="button"
                    className={buttonClass}
                    title="Delete row"
                    onMouseDown={(event) =>
                        event.preventDefault()
                    }
                    onClick={deleteRow}
                >
                    −
                </button>
            </div>
        </>
    );
}