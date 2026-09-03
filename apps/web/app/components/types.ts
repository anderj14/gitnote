export type Note = {
  id: string;
  name: string;
  path: string;
  content: string;
  source?: {
    type: "github";
    owner: string;
    repo: string;
    branch: string;
    path: string;
    sha: string;
  };
};

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export type Folder = {
  id: string;
  name: string;
  documents: Note[];
  folders?: Folder[];
};
