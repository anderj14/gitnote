"use client";

import { useEffect, useState } from "react";

type LinkDialogProps = {
    open: boolean;
    initialUrl?: string;
    onClose: () => void;
    onSubmit: (url: string) => void;
};

export function LinkDialog({
    open,
    initialUrl = "",
    onClose,
    onSubmit,
}: LinkDialogProps) {
    const [url, setUrl] = useState(initialUrl);

    useEffect(() => {
        if (open) {
            setUrl(initialUrl);
        }
    }, [open, initialUrl]);

    if (!open) {
        return null;
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const value = url.trim();

        if (!value) {
            return;
        }

        onSubmit(value);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
            >
                <h2 className="text-lg font-semibold text-zinc-900">
                    Insert link
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                    Add the URL for the selected text.
                </p>

                <input
                    autoFocus
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com"
                    className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
                    >
                        Add link
                    </button>
                </div>
            </form>
        </div>
    );
}