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
