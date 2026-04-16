import { invoke } from "@tauri-apps/api/core";
import type { ProjectInfo, SessionInfo, ConversationMessage } from "./types";

export async function fetchProjects(): Promise<ProjectInfo[]> {
  return invoke("list_projects");
}

export async function fetchSessions(
  projectDirName: string,
): Promise<SessionInfo[]> {
  return invoke("list_sessions", { projectDirName });
}

export async function fetchSession(
  projectDirName: string,
  sessionId: string,
): Promise<ConversationMessage[]> {
  return invoke("load_session", { projectDirName, sessionId });
}

export async function resumeInIterm(
  cwd: string,
  sessionId: string,
): Promise<void> {
  return invoke("resume_in_iterm", { cwd, sessionId });
}

export async function newSessionInIterm(cwd: string): Promise<void> {
  return invoke("new_session_in_iterm", { cwd });
}

export async function deleteSession(
  projectDirName: string,
  sessionId: string,
): Promise<void> {
  return invoke("delete_session", { projectDirName, sessionId });
}

export async function fetchCustomTitles(): Promise<Record<string, string>> {
  return invoke("get_custom_titles");
}

export async function setSessionTitle(
  sessionId: string,
  title: string,
): Promise<void> {
  return invoke("set_session_title", { sessionId, title });
}

export interface BuddyState {
  level: number;
  xp: number;
  totalSessions: number;
  weightStage: number;
  totalCleanups: number;
  lastSessionCount: number;
}

export async function refreshBuddy(): Promise<BuddyState> {
  return invoke("refresh_buddy");
}
