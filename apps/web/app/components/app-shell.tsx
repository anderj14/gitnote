
export function AppShell() {
    return (
        <div className="flex min-h-screen">
            <aside className="w-64 border-r border-zinc-200 bg-zinc-50">
                Sidebar
            </aside>

            <main className="flex-1">
                Editor
            </main>
        </div>
    )
}