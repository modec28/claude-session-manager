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

export async function queueDeletion(
  projectDirName: string,
  sessionId: string,
  sessionTitle: string,
  cwd: string,
): Promise<void> {
  return invoke("queue_deletion", { projectDirName, sessionId, sessionTitle, cwd });
}

export async function checkArchiveExists(sessionId: string): Promise<boolean> {
  return invoke("check_archive_exists", { sessionId });
}

export async function archiveAndDelete(
  projectDirName: string,
  sessionId: string,
  cwd: string,
): Promise<string> {
  return invoke("archive_and_delete", { projectDirName, sessionId, cwd });
}

export async function fetchRunningSessions(): Promise<string[]> {
  return invoke("running_sessions");
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

export interface ArchiveEntry {
  sessionId: string;
  timestamp: string;
  project: string;
  cwd: string;
  branch: string | null;
  issueKeys: string[];
  title: string;
  summary: string;
  tasks: string[];
  filesChanged: string[];
  decisions: string[];
  tags: string[];
  filename: string;
}

export async function fetchArchives(): Promise<ArchiveEntry[]> {
  return invoke("list_archives");
}

export async function removeArchive(filename: string): Promise<void> {
  return invoke("delete_archive", { filename });
}
