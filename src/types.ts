export interface ProjectInfo {
  dirName: string;
  displayPath: string;
  sessionCount: number;
}

export interface SessionInfo {
  sessionId: string;
  title: string;
  timestamp: string;
  messageCount: number;
  cwd: string;
  model: string | null;
}

export interface ConversationMessage {
  uuid: string;
  role: "user" | "assistant" | "system";
  timestamp: string;
  content: ContentBlock[];
  model?: string;
  isSidechain: boolean;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; content: unknown }
  | { type: "thinking"; thinking: string };

export interface SelectedSession {
  projectDirName: string;
  sessionId: string;
  cwd: string;
}
