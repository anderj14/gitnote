import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@gitnote/github";
import { getGitHubClientFromSession } from "../_lib/session";

export async function GET() {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const repositories = await client.getRepositories();

    return NextResponse.json({ repositories });
  } catch {
    return NextResponse.json(
      { error: "Unable to load repositories." },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    private?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const isPrivate = body?.private !== false;

  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name) || name.length > 100) {
    return NextResponse.json(
      { error: "Invalid repository name. Use letters, numbers, -, _, ." },
      { status: 400 },
    );
  }

  try {
    const repository = await client.createRepository({
      name,
      private: isPrivate,
      autoInit: true,
    });

    // Build GitNote manual README for every new repo (@owner personal)
    try {
      const account = await client.getAccount().catch(() => null);
      const ownerLogin = account?.login ?? repository.owner;
      const date = new Date().toISOString().slice(0, 10);
      const manual = buildGitNoteReadme({ repoName: name, owner: ownerLogin, fullName: repository.fullName, branch: repository.defaultBranch, date, isPrivate });
      // Fire-and-forget but await briefly to ensure README is replaced before response
      await client.ensureReadme({
        owner: repository.owner,
        repo: repository.name,
        branch: repository.defaultBranch,
        content: manual,
        message: "docs: add GitNote manual and commands",
      });
    } catch (readmeError) {
      console.warn("Failed to write GitNote README:", readmeError);
      // Do not fail repo creation if README overwrite fails
    }

    return NextResponse.json({ repository }, { status: 201 });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const message =
        error.status === 422
          ? "Repository already exists or name is invalid."
          : error.status === 403
            ? "Missing scope 'repo'. Re-login to grant repository creation permission."
            : "Unable to create repository.";

      return NextResponse.json({ error: message, details: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to create repository." },
      { status: 502 },
    );
  }
}

function buildGitNoteReadme(params: { repoName: string; owner: string; fullName: string; branch: string; date: string; isPrivate: boolean }): string {
  const { repoName, owner, fullName, branch, date, isPrivate } = params;
  return `# ${repoName} — GitNote Workspace

> Workspace Markdown sincronizado con GitHub, creado por **@${owner}** el ${date} en \`${fullName}\` (\`${branch}\` · ${isPrivate ? "Private" : "Public"}). Este README se genera automáticamente al crear el repositorio en GitNote y documenta cómo usar la app.

## ¿Qué es GitNote?

GitNote es un Notion minimal para Markdown con tu repo como fuente de verdad: sidebar de 264px (chrome claro) + editor oscuro/claro con Tiptap, sincronización vía GitHub App (commits con sha), Supabase solo para preferencias (repo seleccionado), sin base de datos de documentos.

## Manual de uso

### 1. Workspace, carpetas y documentos
- **Sidebar** lista \`Root\` + carpetas anidadas. Cada carpeta: \`id: crypto.randomUUID()\`, \`name\`, \`documents[]\`, \`folders?[]\`.
- **Crear documento**: botón \`New\` (⌘N), o right-click en workspace/root/carpeta → *New document*. Elige ubicación (\`Root\` o \`docs/backend\`...), título y plantilla: *Blank, Documentation, Meeting Notes, Technical Design, YouTube Script*. Path se genera como \`{carpeta}/{slug}.md\`.
- **Crear carpeta**: botón \`FolderPlus\` (⌘⇧N) o right-click → *New folder*. Validaciones: nombre requerido, trim, sin \`<>:"/\\\\|?*\`, no \`. / ..\`, no duplicado case-insensitive en el mismo nivel.
- **Rename**: right-click o ⋯ → *Rename*. Para \`*.md\` se asegura \`.md\` y se actualiza \`path\` y \`source.path\` (preserva \`source.sha\`), sin commit automático.
- **Move to...**: right-click → *Move to...* → elige destino \`Root / Documentation / Projects...\`. Se recalcula \`newPath = dest ? \`\${dest}/\${name}\` : name\`, evita duplicados.
- **Delete**: right-click → *Delete* con confirmación *“This action will remove the document from your GitNote workspace.”* — solo local hasta futuro sync. Si borras el doc seleccionado, se selecciona el siguiente o empty state. Si borras carpeta, se eliminan sus docs anidados.
- **Búsqueda**: \`⌘K\` abre \`SearchCommand\` (filtro por \`name path\`), refleja altas/bajas/renombres/moves sin recarga.
- **Atajos**: \`⌘K\` Search, \`⌘N\` New doc, \`⌘⇧N\` New folder, \`⌘B\` Toggle sidebar, click en GitHub avatar → \`/api/github/login\`.

### 2. Editor Markdown (Tiptap 3.31 + @tiptap/markdown)
- **Título** editable arriba + badge \`Markdown · synced/unsaved/saving/error\` y botón *Save* (solo GitHub docs, abre CommitDialog).
- **Toolbar** (\`editor-toolbar.tsx\`): **B** \`toggleBold\`, *I* \`toggleItalic\`, **H1/H2/H3** \`toggleHeading\`, • List \`toggleBulletList\`, 1. List \`toggleOrderedList\`, Quote \`toggleBlockquote\`, ☑ \`toggleTaskList\`, — \`setHorizontalRule\`, Code \`toggleCodeBlock\`, **Table** \`insertTable 3×3\` / *Delete table* si estás dentro, Link/Unlink, ↶↷ undo/redo.
- **Slash** (\`/\`): Text, Heading, Bullet, Numbered, Checklist, Code, **Table**, Quote, Divider — navega ↑↓, ↵ selecciona, Esc cierra.
- **Save → Commit**: \`PUT /api/github/file\` con \`owner/repo/path/branch/sha/content/message\`, actualiza \`sha\` al éxito, maneja 409 (file changed), 401/403 permiso, 5xx red.
- **Markdown paste**: pega tablas/HTML y se preserva; si pegas markdown con \`|\`, se convierte.
- **Outline**: \`RightPanel\` lista \`headings\` extraídos del doc.

### 3. Tablas — estilo Excel
- **Estilo**: \`.tableWrapper\` con \`border 1px radius 0.75rem shadow\`, header \`bg color-mix(editor-raised 96%) uppercase 0.75rem\`, filas hover \`editor-hover 55%\`, celda seleccionada \`primary/14 + ring 35%\`, \`.column-resize-handle\` de 12px (hit-area) con línea azul 2px solo en hover/drag, cursor \`col-resize\`.
- **Insertar**: Toolbar *Table* o \`/ Table\`.
- **Redimensionar**: arrastra el borde entre columnas (como Excel) — \`TableKit resizable true, cellMinWidth 80, lastColumnResizable true\`.
- **Interacción sin botones flotantes**: acerca el mouse a **2px fuera** del borde → cursor cambia a \`copy\`; **right-click** dentro o a 2px fuera abre menú contextual:
  - *Cell*: Clear content, Merge cells (si seleccionas 2 filas/columnas), Split cell
  - *Rows*: Insert row above/below, Delete row
  - *Columns*: Insert column left/right, Delete column
  - *Table*: **Copy** (⌘C), **Cut** (⌘X), **Paste** (⌘V), **Delete table**
- Doble selección: arrastra 2 celdas/filas → right-click → *Merge*; sobre celda mergeada → *Split*.

### 4. Sincronización GitHub
- Conecta en \`/api/github/login\`, elige repo como workspace (o crea uno nuevo privado con este manual). Se guarda selección en Supabase + localStorage y se carga el árbol vía \`GET /api/github/tree?owner&repo&branch\` (solo \`.md\`).
- Abrir doc GitHub hace \`GET /api/github/file?path&ref\` y guarda \`sha\` hasta próximo commit.
- Cambios locales (rename/move/delete/create) marcan \`hasWorkspaceChanges → Modified\` en TopBar y RepoCard, sin commits automáticos — preparados para futuro flujo \`Workspace changes → Git operations → Commit\`.

### 5. Estructura inicial sugerida

\`\`\`
${repoName}/
├── README.md          # ← este manual
├── docs/
│   ├── api.md
│   └── architecture.md
├── projects/
│   └── gitnote.md
└── ideas/
    └── saas-ideas.md
\`\`\`

Puedes crear esa estructura con *New folder* / *New document* desde el sidebar.

### 6. Comandos rápidos dentro de la app

| Área | Comando | Acción |
|------|---------|--------|
| Global | \`⌘K\` | SearchCommand |
| Global | \`⌘N\` | New document |
| Global | \`⌘⇧N\` | New folder |
| Global | \`⌘B\` | Toggle sidebar |
| Editor | \`/\` | Slash menu (bloques) |
| Editor | \`⌘C / ⌘X / ⌘V\` | Copy / Cut / Paste (celda/tabla) |
| Editor | Drag borde | Redimensionar columna (Excel) |
| Tabla | Right-click | Menú contextual tabla |
| Tabla | Selección 2 celdas | Merge / Split |
| Git | Save → Commit | \`Update {file}\` con mensaje |

---

Hecho con GitNote · [Connect GitHub](/api/github/login) · rama por defecto \`${branch}\`.
`;
}
