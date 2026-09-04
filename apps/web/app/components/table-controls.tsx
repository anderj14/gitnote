"use client";

import { useEffect, useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Trash2, Plus, Minus, Combine, Split, Eraser, Table2, Columns3, Rows3, Copy, Scissors, ClipboardPaste } from "lucide-react";

type MenuPos = { x: number; y: number; ox: number; oy: number; table: HTMLTableElement; cell: HTMLElement | null };

export function TableControls({ editor }: { editor: Editor | null }) {
    const [menu, setMenu] = useState<MenuPos | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on outside click / scroll / escape
    useEffect(() => {
        if (!menu) return;
        const onClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenu(null);
        };
        const onScroll = () => setMenu(null);
        window.addEventListener("mousedown", onClick);
        window.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            window.removeEventListener("mousedown", onClick);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [menu]);

    useEffect(() => {
        if (!editor) return;
        const ed = editor;
        const editorElement = ed.view.dom as HTMLElement;

        // Cursor change when within 2px outside table (Excel hint to add row/col)
        function handleMouseMove(e: MouseEvent) {
            const tables = Array.from(editorElement.querySelectorAll("table")) as HTMLTableElement[];
            let nearOutside = false;
            for (const tbl of tables) {
                const r = tbl.getBoundingClientRect();
                const expanded = { left: r.left - 2, right: r.right + 2, top: r.top - 2, bottom: r.bottom + 2 };
                const insideExpanded = e.clientX >= expanded.left && e.clientX <= expanded.right && e.clientY >= expanded.top && e.clientY <= expanded.bottom;
                const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
                if (insideExpanded && !inside) {
                    nearOutside = true;
                    break;
                }
            }
            // near outside table -> hint that right-click will add row/col
            if (nearOutside) {
                editorElement.style.cursor = "copy";
            } else {
                // let column-resize handle override (col-resize)
                if (editorElement.style.cursor === "copy") editorElement.style.cursor = "";
            }
        }

        function handleContextMenu(e: MouseEvent) {
            const x = e.clientX;
            const y = e.clientY;
            const tables = Array.from(editorElement.querySelectorAll("table")) as HTMLTableElement[];

            let targetTable: HTMLTableElement | null = null;
            let targetCell: HTMLElement | null = null;
            let closestDist = Infinity;

            for (const tbl of tables) {
                const r = tbl.getBoundingClientRect();
                // allow 2px tolerance outside
                const expanded = { left: r.left - 2, right: r.right + 2, top: r.top - 2, bottom: r.bottom + 2 };
                const insideExpanded = x >= expanded.left && x <= expanded.right && y >= expanded.top && y <= expanded.bottom;
                if (!insideExpanded) continue;

                // distance to table rect (0 if inside)
                const dx = Math.max(expanded.left - x, 0, x - expanded.right);
                const dy = Math.max(expanded.top - y, 0, y - expanded.bottom);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                    closestDist = dist;
                    targetTable = tbl;
                }
            }

            if (!targetTable) return; // not near table, allow native menu

            // Find closest cell within targetTable (if any)
            const cells = Array.from(targetTable.querySelectorAll("td, th")) as HTMLElement[];
            let closestCell: HTMLElement | null = null;
            let cellDist = Infinity;
            for (const c of cells) {
                const r = c.getBoundingClientRect();
                const cx = Math.max(r.left, Math.min(x, r.right));
                const cy = Math.max(r.top, Math.min(y, r.bottom));
                const d = Math.hypot(x - cx, y - cy);
                if (d < cellDist) {
                    cellDist = d;
                    closestCell = c;
                }
            }
            // If click is within 2px outside but near table edge, still treat as near cell on edge
            // Only consider cell if within ~30px
            if (cellDist > 60) closestCell = null;

            // Select the cell under cursor so commands operate on correct cell
            if (closestCell) {
                try {
                    const pos = ed.view.posAtDOM(closestCell, 0);
                    // Set selection inside that cell to make row/col ops target it
                    // Use TextSelection inside cell, or CellSelection if we want whole cell
                    ed.view.dispatch(ed.view.state.tr.setSelection(
                        // @ts-expect-error prosemirror types
                        ed.state.selection.constructor.create ? ed.state.selection.constructor.create(ed.state.doc, pos + 1) : ed.state.selection
                    ));
                    // Simpler: setTextSelection
                    ed.commands.setTextSelection(pos + 1);
                } catch {}
            }

            e.preventDefault();
            e.stopPropagation();

            // Initial placement at cursor, actual flip is corrected after measuring real height (window-based)
            const MENU_W = 240;
            const pad = 8;
            let mx = x;
            let my = y;
            // Horizontal clamp
            if (x + MENU_W + pad > window.innerWidth) mx = window.innerWidth - MENU_W - pad;
            mx = Math.max(pad, mx);
            my = Math.max(pad, my);
            setMenu({ x: mx, y: my, ox: x, oy: y, table: targetTable, cell: closestCell });
        }

        editorElement.addEventListener("mousemove", handleMouseMove);
        editorElement.addEventListener("contextmenu", handleContextMenu);
        return () => {
            editorElement.removeEventListener("mousemove", handleMouseMove);
            editorElement.removeEventListener("contextmenu", handleContextMenu);
            editorElement.style.cursor = "";
        };
    }, [editor]);

    // After mount, ensure whole box fits in viewport — flip entirely up/left if clipped (window-based)
    useEffect(() => {
        if (!menu || !menuRef.current) return;
        const el = menuRef.current;
        const rect = el.getBoundingClientRect();
        const pad = 8;
        let nx = menu.x;
        let ny = menu.y;
        let needsUpdate = false;

        // Horizontal: if overflows right, flip left of cursor
        if (rect.right > window.innerWidth - pad) {
            const flippedX = menu.ox - rect.width - 4;
            if (flippedX >= pad) { nx = flippedX; needsUpdate = true; }
            else { nx = window.innerWidth - rect.width - pad; needsUpdate = true; }
        }
        if (rect.left < pad) { nx = pad; needsUpdate = true; }

        // Vertical: if overflows bottom, show entirely above cursor
        if (rect.bottom > window.innerHeight - pad) {
            const flippedY = menu.oy - rect.height - 4;
            if (flippedY >= pad) { ny = flippedY; needsUpdate = true; }
            else { ny = window.innerHeight - rect.height - pad; needsUpdate = true; }
        }
        if (rect.top < pad) { ny = pad; needsUpdate = true; }

        if (needsUpdate) setMenu((m) => (m ? { ...m, x: nx, y: ny } : m));
    }, [menu]);

    if (!menu || !editor) return null;

    const ed = editor;

    // Helpers to check capabilities
    const currentMenu = menu!;
    const canMerge = (() => {
        try { return ed.can().chain().focus().mergeCells().run(); } catch { return false; }
    })();
    const canSplit = (() => {
        try { return ed.can().chain().focus().splitCell().run(); } catch { return false; }
    })();
    const isInCell = !!currentMenu.cell;
    const isHeader = currentMenu.cell?.tagName.toLowerCase() === "th";

    function clearCell() {
        if (!currentMenu.cell) return;
        try {
            const pos = ed.view.posAtDOM(currentMenu.cell, 0);
            const $pos = ed.state.doc.resolve(pos + 1);
            // Find cell depth
            for (let d = $pos.depth; d > 0; d--) {
                const node = $pos.node(d);
                if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                    const start = $pos.before(d);
                    const end = $pos.after(d);
                    // Keep cell, clear content to empty paragraph
                    const tr = ed.state.tr;
                    // delete between start+1 and end-1
                    if (end - start > 2) tr.delete(start + 1, end - 1);
                    const paragraph = ed.state.schema.nodes.paragraph?.create();
                    if (paragraph) tr.insert(start + 1, paragraph);
                    ed.view.dispatch(tr);
                    break;
                }
            }
        } catch {}
        setMenu(null);
    }

    function run(fn: () => boolean) {
        fn();
        setMenu(null);
        setTimeout(() => ed.commands.focus(), 0);
    }

    async function handleCopy() {
        try {
            // ProseMirror handles copy of CellSelection / Table correctly via execCommand
            document.execCommand("copy");
            const text = window.getSelection()?.toString() || ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, "\n");
            if (text) await navigator.clipboard.writeText(text).catch(() => {});
        } catch {
            try {
                const text = ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, "\n");
                await navigator.clipboard.writeText(text);
            } catch {}
        }
        setMenu(null);
    }

    async function handleCut() {
        await handleCopy();
        try {
            ed.chain().focus().deleteSelection().run();
        } catch {}
        setMenu(null);
    }

    async function handlePaste() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                // Insert as markdown if looks like markdown table, otherwise plain
                // Let Tiptap handle HTML paste via insertContent
                ed.chain().focus().insertContent(text).run();
            }
        } catch {
            // Fallback: focus and let native paste happen on next user paste
            ed.commands.focus();
            document.execCommand("paste");
        }
        setMenu(null);
    }

    async function handleDeleteTable() {
        // Ensure table is selected before delete
        const pos = (() => {
            try { return ed.view.posAtDOM(currentMenu.table, 0); } catch { return null; }
        })();
        if (pos !== null) {
            try { ed.chain().focus().setNodeSelection(pos).run(); } catch {}
        }
        run(() => ed.chain().focus().deleteTable().run());
    }

    const itemClass = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-accent hover:text-accent-foreground";
    const destructiveClass = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-destructive hover:bg-destructive/10";
    const labelClass = "label-caps px-2 py-1 text-[10px] text-muted-foreground";

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[220px] rounded-xl border border-border bg-popover p-1.5 shadow-float backdrop-blur-sm"
            style={{ left: currentMenu.x, top: currentMenu.y }}
            role="menu"
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="max-h-[70vh] overflow-y-auto">
                {isInCell && (
                    <>
                        <div className={labelClass}>Cell</div>
                        <button type="button" className={itemClass} onClick={clearCell}>
                            <Eraser className="size-3.5" /> Clear content
                        </button>
                        {canMerge && (
                            <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().mergeCells().run())}>
                                <Combine className="size-3.5" /> Merge cells
                            </button>
                        )}
                        {canSplit && (
                            <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().splitCell().run())}>
                                <Split className="size-3.5" /> Split cell
                            </button>
                        )}
                        <div className="my-1 h-px bg-border" />
                    </>
                )}

                <div className={labelClass}><Rows3 className="mr-1 inline size-3" /> Rows</div>
                <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().addRowBefore().run())}>
                    <Plus className="size-3.5" /> Insert row above
                </button>
                <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().addRowAfter().run())}>
                    <Plus className="size-3.5" /> Insert row below
                </button>
                <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().deleteRow().run())}>
                    <Minus className="size-3.5" /> Delete row
                </button>

                <div className="my-1 h-px bg-border" />
                <div className={labelClass}><Columns3 className="mr-1 inline size-3" /> Columns</div>
                <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().addColumnBefore().run())}>
                    <Plus className="size-3.5" /> Insert column left
                </button>
                <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().addColumnAfter().run())}>
                    <Plus className="size-3.5" /> Insert column right
                </button>
                <button type="button" className={itemClass} onClick={() => run(() => ed.chain().focus().deleteColumn().run())}>
                    <Minus className="size-3.5" /> Delete column
                </button>

                <div className="my-1 h-px bg-border" />
                <div className={labelClass}><Table2 className="mr-1 inline size-3" /> Table</div>
                <button type="button" className={itemClass} onClick={handleCopy}>
                    <Copy className="size-3.5" /> Copy <span className="ml-auto text-[11px] opacity-50">⌘C</span>
                </button>
                <button type="button" className={itemClass} onClick={handleCut}>
                    <Scissors className="size-3.5" /> Cut <span className="ml-auto text-[11px] opacity-50">⌘X</span>
                </button>
                <button type="button" className={itemClass} onClick={handlePaste}>
                    <ClipboardPaste className="size-3.5" /> Paste <span className="ml-auto text-[11px] opacity-50">⌘V</span>
                </button>
                <button
                    type="button"
                    className={destructiveClass}
                    onClick={handleDeleteTable}
                >
                    <Trash2 className="size-3.5" /> Delete table
                </button>
                <p className="px-2 pt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Tip: arrastra el borde de la columna como en Excel para ajustar ancho. Click derecho a 2px del borde también abre este menú para agregar filas.
                </p>
            </div>
        </div>
    );
}
