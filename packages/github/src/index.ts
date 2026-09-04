export type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
};

export type GitHubAccount = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type GitHubTreeItem = {
  path: string;
  type: "tree" | "blob";
  sha: string;
  size?: number;
};

export type GitHubMarkdownFile = {
  name: string;
  path: string;
  sha: string;
  size?: number;
};

export type GitHubRepositoryTree = {
  folders: string[];
  files: GitHubMarkdownFile[];
};

export type GitHubFile = {
  path: string;
  name: string;
  content: string;
  sha: string;
};

export type GitCommit = {
  sha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorAvatarUrl?: string;
  date: string;
  parentSha?: string;
};

export type GitCommitFile = {
  path: string;
  previousPath?: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  sha?: string;
};

export type GitCommitDetails = {
  sha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorAvatarUrl?: string;
  date: string;
  parentSha?: string;
  files: GitCommitFile[];
  stats: { additions: number; deletions: number; total: number };
};

export type GitHubUpdateFileParams = {
  owner: string;
  repo: string;
  path: string;
  content: string;
  sha: string;
  message: string;
  branch: string;
};

export type GitHubUpdateFileResult = {
  sha: string;
  path: string;
};

type GitHubClientOptions = {
  accessToken: string;
  apiVersion?: string;
};

type GitHubUserResponse = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
};

type GitHubInstallationResponse = {
  id: number;
};

type GitHubInstallationsResponse = {
  installations: GitHubInstallationResponse[];
};

type GitHubRepositoryResponse = {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  default_branch: string;
  description: string | null;
};

type GitHubInstallationRepositoriesResponse = {
  repositories: GitHubRepositoryResponse[];
};

type GitHubTreeResponse = {
  tree: Array<{
    path?: string;
    type?: string;
    sha?: string;
    size?: number;
  }>;
  truncated: boolean;
};

type GitHubContentsResponse = {
  sha: string;
  name: string;
  path: string;
  content: string;
  encoding: string;
};

type GitHubCommitsResponse = Array<{
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
  committer: { login: string; avatar_url: string } | null;
  parents: Array<{ sha: string }>;
}>;

type GitHubCommitResponse = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
  committer: { login: string; avatar_url: string } | null;
  parents: Array<{ sha: string }>;
  files?: Array<{
    filename: string;
    previous_filename?: string;
    status: string;
    additions: number;
    deletions: number;
    sha?: string;
  }>;
  stats?: { additions: number; deletions: number; total: number };
};

type GitHubUpdateContentsResponse = {
  content: {
    sha: string;
    path: string;
  };
};

const GITHUB_API_URL = "https://api.github.com";
const DEFAULT_API_VERSION = "2022-11-28";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubClient {
  private readonly accessToken: string;
  private readonly apiVersion: string;

  constructor({ accessToken, apiVersion = DEFAULT_API_VERSION }: GitHubClientOptions) {
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
  }

  async getAccount(): Promise<GitHubAccount> {
    const user = await this.request<GitHubUserResponse>("/user");

    return {
      id: user.id,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    };
  }

  async getRepositories(): Promise<GitHubRepository[]> {
    const [installationRepos, userRepos] = await Promise.all([
      this.getInstallationRepositories().catch(() => [] as GitHubRepository[]),
      this.getUserRepositories().catch(() => [] as GitHubRepository[]),
    ]);

    const uniqueRepositories = new Map<number, GitHubRepository>();

    for (const repository of [...installationRepos, ...userRepos]) {
      uniqueRepositories.set(repository.id, repository);
    }

    return [...uniqueRepositories.values()].sort((left, right) =>
      left.fullName.localeCompare(right.fullName),
    );
  }

  async getInstallationRepositories(): Promise<GitHubRepository[]> {
    const installations = await this.request<GitHubInstallationsResponse>(
      "/user/installations",
    );

    if (installations.installations.length === 0) {
      return [];
    }

    const repositoryGroups = await Promise.all(
      installations.installations.map((installation) =>
        this.request<GitHubInstallationRepositoriesResponse>(
          `/user/installations/${installation.id}/repositories?per_page=100`,
        ),
      ),
    );

    const repositories = repositoryGroups.flatMap((group) => group.repositories);
    const uniqueRepositories = new Map<number, GitHubRepositoryResponse>();

    for (const repository of repositories) {
      uniqueRepositories.set(repository.id, repository);
    }

    return [...uniqueRepositories.values()]
      .map(mapRepository)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  async getUserRepositories(): Promise<GitHubRepository[]> {
    const repositories = await this.request<GitHubRepositoryResponse[]>(
      "/user/repos?per_page=100&sort=updated&affiliation=owner",
    );

    return repositories.map(mapRepository).sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  async createRepository(params: {
    name: string;
    description?: string;
    private?: boolean;
    autoInit?: boolean;
  }): Promise<GitHubRepository> {
    const response = await this.request<GitHubRepositoryResponse>("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        description: params.description ?? `GitNote workspace - ${params.name}`,
        private: params.private ?? true,
        auto_init: params.autoInit ?? true,
      }),
    });

    return mapRepository(response);
  }

  async getRepositoryTree(params: {
    owner: string;
    repo: string;
    branch: string;
  }): Promise<GitHubRepositoryTree> {
    const tree = await this.request<GitHubTreeResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(
        params.repo,
      )}/git/trees/${encodeURIComponent(params.branch)}?recursive=1`,
    );

    if (tree.truncated) {
      throw new GitHubApiError(
        "Repository tree is too large to load completely.",
        422,
      );
    }

    const folders = new Set<string>();
    const files: GitHubMarkdownFile[] = [];

    for (const item of tree.tree) {
      if (!isValidTreeItem(item)) {
        continue;
      }

      if (item.type === "tree") {
        folders.add(item.path);
        continue;
      }

      if (item.type === "blob" && isMarkdownPath(item.path)) {
        addParentFolders(item.path, folders);
        files.push({
          name: getBaseName(item.path),
          path: item.path,
          sha: item.sha,
          size: item.size,
        });
      }
    }

    return {
      folders: [...folders].sort((left, right) => left.localeCompare(right)),
      files: files.sort((left, right) => left.path.localeCompare(right.path)),
    };
  }

  async getCommitHistory(params: {
    owner: string;
    repo: string;
    branch: string;
    path?: string;
    perPage?: number;
  }): Promise<GitCommit[]> {
    const searchParams = new URLSearchParams({ sha: params.branch, per_page: String(params.perPage ?? 30) });
    if (params.path) searchParams.set("path", params.path);
    const data = await this.request<GitHubCommitsResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/commits?${searchParams.toString()}`,
    );
    return data.map((item) => ({
      sha: item.sha,
      message: item.commit.message,
      authorName: item.commit.author?.name ?? item.commit.committer?.name ?? item.author?.login ?? "Unknown author",
      authorEmail: item.commit.author?.email ?? item.commit.committer?.email,
      authorAvatarUrl: item.author?.avatar_url ?? item.committer?.avatar_url,
      date: item.commit.author?.date ?? item.commit.committer?.date ?? new Date().toISOString(),
      parentSha: item.parents[0]?.sha,
    }));
  }

  async getCommitDetails(params: { owner: string; repo: string; sha: string }): Promise<GitCommitDetails> {
    const data = await this.request<GitHubCommitResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/commits/${encodeURIComponent(params.sha)}`,
    );
    const files: GitCommitFile[] = (data.files ?? []).map((f) => ({
      path: f.filename,
      previousPath: f.previous_filename,
      status: mapCommitFileStatus(f.status),
      additions: f.additions,
      deletions: f.deletions,
      sha: f.sha,
    }));
    return {
      sha: data.sha,
      message: data.commit.message,
      authorName: data.commit.author?.name ?? data.commit.committer?.name ?? data.author?.login ?? "Unknown author",
      authorEmail: data.commit.author?.email ?? data.commit.committer?.email,
      authorAvatarUrl: data.author?.avatar_url ?? data.committer?.avatar_url,
      date: data.commit.author?.date ?? data.commit.committer?.date ?? new Date().toISOString(),
      parentSha: data.parents[0]?.sha,
      files,
      stats: data.stats ?? { additions: files.reduce((a, f) => a + f.additions, 0), deletions: files.reduce((a, f) => a + f.deletions, 0), total: files.length },
    };
  }

  async getTreeAtCommit(params: { owner: string; repo: string; sha: string }): Promise<GitHubRepositoryTree> {
    // Get commit to find tree sha, then fetch tree recursively
    const commit = await this.request<{ tree: { sha: string } }>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/commits/${encodeURIComponent(params.sha)}`,
    );
    const tree = await this.request<GitHubTreeResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/trees/${encodeURIComponent(commit.tree.sha)}?recursive=1`,
    );
    if (tree.truncated) throw new GitHubApiError("Repository tree is too large.", 422);
    const folders = new Set<string>();
    const files: GitHubMarkdownFile[] = [];
    for (const item of tree.tree) {
      if (!isValidTreeItem(item)) continue;
      if (item.type === "tree") folders.add(item.path);
      else if (item.type === "blob" && isMarkdownPath(item.path)) {
        addParentFolders(item.path, folders);
        files.push({ name: getBaseName(item.path), path: item.path, sha: item.sha, size: item.size });
      }
    }
    return {
      folders: [...folders].sort((a, b) => a.localeCompare(b)),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }

  async getFile(params: {
    owner: string;
    repo: string;
    path: string;
    ref: string;
  }): Promise<GitHubFile> {
    const searchParams = new URLSearchParams({ ref: params.ref });
    const data = await this.request<GitHubContentsResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(
        params.repo,
      )}/contents/${encodePath(params.path)}?${searchParams.toString()}`,
    );

    if (data.encoding !== "base64" || typeof data.content !== "string") {
      throw new GitHubApiError("Unexpected GitHub file encoding.", 502);
    }

    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");

    return {
      path: data.path ?? params.path,
      name: data.name ?? getBaseName(params.path),
      content,
      sha: data.sha,
    };
  }

  async updateFile(params: GitHubUpdateFileParams): Promise<GitHubUpdateFileResult> {
    const encodedContent = Buffer.from(params.content, "utf8").toString("base64");

    const data = await this.request<GitHubUpdateContentsResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(
        params.repo,
      )}/contents/${encodePath(params.path)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: params.message,
          content: encodedContent,
          sha: params.sha,
          branch: params.branch,
        }),
      },
    );

    return {
      sha: data.content.sha,
      path: data.content.path,
    };
  }

  async createFile(params: {
    owner: string;
    repo: string;
    path: string;
    content: string;
    message: string;
    branch: string;
  }): Promise<GitHubUpdateFileResult> {
    const encodedContent = Buffer.from(params.content, "utf8").toString("base64");
    const data = await this.request<GitHubUpdateContentsResponse>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/contents/${encodePath(params.path)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: params.message,
          content: encodedContent,
          branch: params.branch,
        }),
      },
    );
    return { sha: data.content.sha, path: data.content.path };
  }

  async deleteFile(params: {
    owner: string;
    repo: string;
    path: string;
    sha: string;
    message: string;
    branch: string;
  }): Promise<void> {
    await this.request<unknown>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/contents/${encodePath(params.path)}`,
      {
        method: "DELETE",
        body: JSON.stringify({
          message: params.message,
          sha: params.sha,
          branch: params.branch,
        }),
      },
    );
  }

  // Multi-file atomic commit via Git Data API (blobs -> tree -> commit -> ref)
  async commitChanges(params: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    changes: Array<{
      type: "added" | "modified" | "deleted" | "renamed";
      path: string;
      oldPath?: string;
      content?: string;
      sha?: string;
    }>;
  }): Promise<{ commitSha: string }> {
    if (params.changes.length === 0) throw new GitHubApiError("No changes to commit.", 400);

    // 1. Get current branch ref to obtain base commit sha
    const ref = await this.request<{ object: { sha: string } }>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/ref/heads/${encodeURIComponent(params.branch)}`,
    );
    const baseCommitSha = ref.object.sha;

    // 2. Get base commit to obtain base tree sha
    const baseCommit = await this.request<{ tree: { sha: string } }>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/commits/${baseCommitSha}`,
    );
    const baseTreeSha = baseCommit.tree.sha;

    // 3. Create blobs for added/modified (and renamed new path)
    const blobMap = new Map<string, string>(); // path -> blob sha
    for (const change of params.changes) {
      if (change.type === "deleted") continue;
      // For renamed, the new content is at change.path (content may be undefined if only path changed, but if renamed without modification content is still needed - fetch original? Assume content provided)
      const content = change.content ?? "";
      // Skip blob creation for renamed without content change? Need blob even if same content to ensure file exists at new path (original content)
      const blobSha = await this.createBlob({ owner: params.owner, repo: params.repo, content });
      blobMap.set(change.path, blobSha);
    }

    // 4. Build tree entries
    const treeEntries: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
    for (const change of params.changes) {
      if (change.type === "deleted") {
        treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      } else if (change.type === "renamed" && change.oldPath) {
        // Delete old path
        treeEntries.push({ path: change.oldPath, mode: "100644", type: "blob", sha: null });
        // Create new path
        const blobSha = blobMap.get(change.path);
        if (!blobSha) throw new GitHubApiError(`Missing blob for renamed file ${change.path}`, 400);
        treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blobSha });
      } else {
        // added / modified
        const blobSha = blobMap.get(change.path);
        if (!blobSha) throw new GitHubApiError(`Missing blob for ${change.path}`, 400);
        treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blobSha });
      }
    }

    // 5. Create new tree
    const newTree = await this.request<{ sha: string }>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      },
    );

    // 6. Create commit
    const newCommit = await this.request<{ sha: string }>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message: params.message,
          tree: newTree.sha,
          parents: [baseCommitSha],
        }),
      },
    );

    // 7. Update ref
    await this.request<unknown>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/refs/heads/${encodeURIComponent(params.branch)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ sha: newCommit.sha, force: false }),
      },
    );

    return { commitSha: newCommit.sha };
  }

  private async createBlob(params: { owner: string; repo: string; content: string }): Promise<string> {
    const encoded = Buffer.from(params.content, "utf8").toString("base64");
    const data = await this.request<{ sha: string }>(
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({ content: encoded, encoding: "base64" }),
      },
    );
    return data.sha;
  }

  async ensureReadme(params: {
    owner: string;
    repo: string;
    branch: string;
    content: string;
    message: string;
  }): Promise<void> {
    // Try to overwrite existing README from auto_init, else create
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const existing = await this.getFile({
          owner: params.owner,
          repo: params.repo,
          path: "README.md",
          ref: params.branch,
        });
        await this.updateFile({
          owner: params.owner,
          repo: params.repo,
          path: "README.md",
          content: params.content,
          sha: existing.sha,
          message: params.message,
          branch: params.branch,
        });
        return;
      } catch (e) {
        const status = e instanceof GitHubApiError ? e.status : 0;
        // 404 = not yet created (auto_init not finished or empty repo) -> try create
        if (status === 404) {
          try {
            await this.createFile({
              owner: params.owner,
              repo: params.repo,
              path: "README.md",
              content: params.content,
              message: params.message,
              branch: params.branch,
            });
            return;
          } catch {}
        }
        // Wait for GitHub to finish initializing default branch
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${GITHUB_API_URL}${path}`, {
      ...init,
      headers: {
        ...this.headers("application/vnd.github+json"),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GitHubApiError(
        body || "GitHub API request failed.",
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }

  private async requestText(path: string, accept: string): Promise<string> {
    const response = await fetch(`${GITHUB_API_URL}${path}`, {
      headers: this.headers(accept),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new GitHubApiError("GitHub API request failed.", response.status);
    }

    return response.text();
  }

  private headers(accept: string): HeadersInit {
    return {
      Accept: accept,
      Authorization: `Bearer ${this.accessToken}`,
      "X-GitHub-Api-Version": this.apiVersion,
    };
  }
}

function mapRepository(repository: GitHubRepositoryResponse): GitHubRepository {
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    owner: repository.owner.login,
    private: repository.private,
    defaultBranch: repository.default_branch,
    description: repository.description,
  };
}

function isValidTreeItem(item: {
  path?: string;
  type?: string;
  sha?: string;
}): item is GitHubTreeItem {
  return (
    typeof item.path === "string" &&
    (item.type === "tree" || item.type === "blob") &&
    typeof item.sha === "string"
  );
}

function isMarkdownPath(path: string): boolean {
  const lowerPath = path.toLowerCase();

  return lowerPath.endsWith(".md") || lowerPath.endsWith(".markdown");
}

function addParentFolders(path: string, folders: Set<string>): void {
  const segments = path.split("/");

  for (let index = 1; index < segments.length; index += 1) {
    folders.add(segments.slice(0, index).join("/"));
  }
}

function getBaseName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function mapCommitFileStatus(status: string): GitCommitFile["status"] {
  switch (status) {
    case "added": return "added";
    case "removed": return "removed";
    case "renamed": return "renamed";
    default: return "modified";
  }
}
