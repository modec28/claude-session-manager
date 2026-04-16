import { useEffect, useState } from "react";
import { fetchSessions } from "../../api";
import type { ProjectInfo, SelectedSession, SessionInfo } from "../../types";
import SessionItem from "./SessionItem";

interface ProjectGroupProps {
  project: ProjectInfo;
  selected: SelectedSession | null;
  onSelect: (session: SelectedSession) => void;
  customTitles: Record<string, string>;
  onTitleChange: (sessionId: string, title: string) => Promise<void>;
  refreshKey: number;
  runningSessions: Set<string>;
  showArchived: boolean;
}

export default function ProjectGroup({
  project,
  selected,
  onSelect,
  customTitles,
  onTitleChange,
  refreshKey,
  runningSessions,
  showArchived,
}: ProjectGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (expanded) {
      fetchSessions(project.dirName)
        .then((result) => {
          setSessions(result);
          setLoaded(true);
        })
        .catch(console.error);
    }
  }, [expanded, project.dirName, refreshKey]);

  const visibleSessions = showArchived
    ? sessions
    : sessions.filter((s) => !s.archived);
  const archivedCount = sessions.filter((s) => s.archived).length;
  const isProjectSelected = selected?.projectDirName === project.dirName;

  const countDisplay = loaded
    ? showArchived
      ? `${sessions.length}`
      : archivedCount > 0
        ? `${visibleSessions.length}+${archivedCount}`
        : `${visibleSessions.length}`
    : `${project.sessionCount}`;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-xs hover:opacity-80 transition-opacity"
        style={{
          color: isProjectSelected
            ? "var(--accent-blue)"
            : "var(--text-secondary)",
        }}
      >
        <span
          className="transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          &#9654;
        </span>
        <span className="truncate flex-1 font-medium">{project.displayPath}</span>
        <span
          className="text-[10px] px-1.5 rounded"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          {countDisplay}
        </span>
      </button>
      {expanded && (
        <div className="ml-3">
          {visibleSessions.length === 0 && loaded ? (
            <div
              className="px-3 py-1.5 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              All {archivedCount} sessions archived
            </div>
          ) : (
            visibleSessions.map((session) => (
              <SessionItem
                key={session.sessionId}
                session={session}
                projectDirName={project.dirName}
                isSelected={selected?.sessionId === session.sessionId}
                onSelect={onSelect}
                customTitle={customTitles[session.sessionId] ?? null}
                onTitleChange={onTitleChange}
                isRunning={runningSessions.has(session.sessionId)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
