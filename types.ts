
export interface UploadedFile {
  path: string;
  content: string;
}

// This is what the AI is instructed to return in its JSON block.
export interface FileChange {
  filePath: string;
  newContent: string;
}

// This is what we store in the ChatMessage state, after enriching it with the old content for diffing.
export interface ProposedChange extends FileChange {
  oldContent: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  attachments?: { name: string }[];
  proposedChanges?: ProposedChange[];
  error?: string;
  warning?: string;
}

export interface TreeNodeValue {
  type: 'file' | 'folder';
  file?: UploadedFile;
  children?: FileTreeNode;
}

export interface FileTreeNode {
  [key: string]: TreeNodeValue;
}

export type GeminiModel = 'gemini-2.5-flash';

export const AVAILABLE_MODELS: GeminiModel[] = [
  'gemini-2.5-flash'
];