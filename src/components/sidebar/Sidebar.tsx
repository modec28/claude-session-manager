import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProjects, fetchSessions, newSessionInIterm } from "../../api";
import type { ProjectInfo, SelectedSession, SessionInfo } from "../../types";
import BuddyWidget from "./BuddyWidget";

interface SidebarProps {
  selected: SelectedSession | null;
  onSelect: (session: SelectedSession) => void;
  customTitles: Record<string, string>;
  refreshKey: number;
  runningSessions: Set<string>;
}

interface FlatItem {
  type: "project" | "session";
  projectDirName: string;
  session?: SessionInfo;
}

export default function Sidebar({
  selected,
  onSelect,
  customTitles,
  refreshKey,
  runningSessions,
}: SidebarProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectSessions, setProjectSessions] = useState<Record<string, SessionInfo[]>>({});
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const loadSessions = useCallback(
    async (projectDirName: string) => {
      try {
        const sessions = await fetchSessions(projectDirName);
        setProjectSessions((prev) => ({ ...prev, [projectDirName]: sessions }));
      } catch (error) {
        console.error(error);
      }
    },
    [projectSessions],
  );

  const toggleProject = useCallback(
    (projectDirName: string) => {
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        if (next.has(projectDirName)) {
          next.delete(projectDirName);
        } else {
          next.add(projectDirName);
          loadSessions(projectDirName);
        }
        return next;
      });
    },
    [loadSessions],
  );

  useEffect(() => {
    for (const projectDirName of expandedProjects) {
      fetchSessions(projectDirName)
        .then((sessions) =>
          setProjectSessions((prev) => ({ ...prev, [projectDirName]: sessions })),
        )
        .catch(console.error);
    }
  }, [refreshKey]);

  const filtered = searchQuery
    ? projects.filter((project) =>
        project.displayPath.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : projects;

  const flatItems: FlatItem[] = [];
  for (const project of filtered) {
    flatItems.push({ type: "project", projectDirName: project.dirName });
    if (expandedProjects.has(project.dirName)) {
      const sessions = projectSessions[project.dirName] ?? [];
      const visible = showArchived
        ? sessions
        : sessions.filter((session) => !session.archived);
      for (const session of visible) {
        flatItems.push({
          type: "session",
          projectDirName: project.dirName,
          session,
        });
      }
    }
  }

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT") return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        const item = flatItems[focusIndex];
        if (!item) return;
        if (item.type === "project") {
          if (!expandedProjects.has(item.projectDirName)) {
            toggleProject(item.projectDirName);
          }
        } else if (item.session) {
          onSelect({
            projectDirName: item.projectDirName,
            sessionId: item.session.sessionId,
            cwd: item.session.cwd,
          });
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        const item = flatItems[focusIndex];
        if (!item) return;
        if (item.type === "project" && expandedProjects.has(item.projectDirName)) {
          toggleProject(item.projectDirName);
        } else if (item.type === "session") {
          const projectIndex = flatItems.findIndex(
            (flatItem) => flatItem.type === "project" && flatItem.projectDirName === item.projectDirName,
          );
          if (projectIndex >= 0) setFocusIndex(projectIndex);
        }
      }
    },
    [flatItems, focusIndex, expandedProjects, toggleProject, onSelect],
  );

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < flatItems.length) {
      const element = listRef.current?.querySelector(`[data-idx="${focusIndex}"]`);
      element?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  const handleNewSession = async () => {
    setErrorMessage(null);
    try {
      await newSessionInIterm(selected?.cwd || "~");
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  return (
    <aside
      className="flex flex-col h-full border-r outline-none"
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        background: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="p-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            SESSIONS
          </span>
          <button
            onClick={handleNewSession}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent-green)",
              color: "var(--bg-primary)",
            }}
            title="New Claude session in iTerm2"
          >
            + New
          </button>
        </div>
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full px-2 py-1.5 rounded text-xs outline-none"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-color)",
          }}
        />
        <label
          className="flex items-center gap-1.5 mt-2 text-[10px] cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="w-3 h-3"
          />
          Show archived
        </label>
        {errorMessage && (
          <div
            className="mt-2 p-2 rounded text-[10px]"
            style={{
              background: "rgba(243, 139, 168, 0.12)",
              color: "var(--accent-red)",
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {loading ? (
          <div className="p-4 text-center" style={{ color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : (
          flatItems.map((item, index) => {
            const isFocused = index === focusIndex;

            if (item.type === "project") {
              const project = filtered.find((p) => p.dirName === item.projectDirName);
              if (!project) return null;
              const isExpanded = expandedProjects.has(project.dirName);
              const sessions = projectSessions[project.dirName] ?? [];
              const archivedCount = sessions.filter((s) => s.archived).length;
              const visibleCount = showArchived
                ? sessions.length
                : sessions.length - archivedCount;

              return (
                <button
                  key={`p-${project.dirName}`}
                  data-idx={index}
                  onClick={() => toggleProject(project.dirName)}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-xs hover:opacity-80 transition-opacity"
                  style={{
                    color: isFocused
                      ? "var(--accent-blue)"
                      : "var(--text-secondary)",
                    background: isFocused
                      ? "rgba(137, 180, 250, 0.08)"
                      : "transparent",
                  }}
                >
                  <span
                    className="transition-transform"
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  >
                    &#9654;
                  </span>
                  <span className="truncate flex-1 font-medium">
                    {project.displayPath}
                  </span>
                  <span
                    className="text-[10px] px-1.5 rounded"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {sessions.length > 0
                      ? `${visibleCount}${!showArchived && archivedCount > 0 ? `+${archivedCount}` : ""}`
                      : showArchived
                        ? project.sessionCount
                        : `${project.sessionCount - project.archivedCount}${project.archivedCount > 0 ? `+${project.archivedCount}` : ""}`}
                  </span>
                </button>
              );
            }

            const session = item.session!;
            const isSelected = selected?.sessionId === session.sessionId;
            const displayTitle =
              customTitles[session.sessionId] || session.title;
            const isRunning = runningSessions.has(session.sessionId);

            return (
              <button
                key={`s-${session.sessionId}`}
                data-idx={index}
                onClick={() =>
                  onSelect({
                    projectDirName: item.projectDirName,
                    sessionId: session.sessionId,
                    cwd: session.cwd,
                  })
                }
                className="w-full flex flex-col gap-0.5 px-3 py-1.5 ml-3 text-left rounded-sm transition-colors"
                style={{
                  background: isFocused
                    ? "rgba(137, 180, 250, 0.08)"
                    : isSelected
                      ? "var(--bg-surface)"
                      : "transparent",
                  borderLeft: isSelected
                    ? "2px solid var(--accent-blue)"
                    : "2px solid transparent",
                  maxWidth: "calc(var(--sidebar-width) - 12px)",
                }}
              >
                <span
                  className="text-xs truncate w-full"
                  style={{
                    color: isFocused || isSelected
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  }}
                >
                  {displayTitle}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatTimestamp(session.timestamp)}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {session.messageCount} msgs
                  </span>
                  {session.model && (
                    <span
                      className="text-[10px] px-1 rounded"
                      style={{
                        background: "var(--bg-hover)",
                        color: "var(--accent-mauve)",
                      }}
                    >
                      {session.model.replace("claude-", "")}
                    </span>
                  )}
                  {isRunning && (
                    <span
                      className="text-[10px] px-1 rounded font-bold"
                      style={{
                        background: "rgba(166, 227, 161, 0.2)",
                        color: "var(--accent-green)",
                      }}
                    >
                      Running
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
      <BuddyWidget refreshKey={refreshKey} />
    </aside>
  );
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return "";
  }
}
