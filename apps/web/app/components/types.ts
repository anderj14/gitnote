export type Note = {
  id: string;
  name: string;
  path: string;
  content: string;
};

export type Folder = {
  id: string;
  name: string;
  documents: Note[];
};