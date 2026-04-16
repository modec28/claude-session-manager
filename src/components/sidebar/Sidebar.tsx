import { useEffect, useState } from "react";
import { fetchProjects, newSessionInIterm } from "../../api";
import type { ProjectInfo, SelectedSession } from "../../types";
import ProjectGroup from "./ProjectGroup";
import BuddyWidget from "./BuddyWidget";

interface SidebarProps {
  selected: SelectedSession | null;
  onSelect: (session: SelectedSession) => void;
  customTitles: Record<string, string>;
  onTitleChange: (sessionId: string, title: string) => Promise<void>;
  refreshKey: number;
  runningSessions: Set<string>;
}

export default function Sidebar({
  selected,
  onSelect,
  customTitles,
  onTitleChange,
  refreshKey,
  runningSessions,
}: SidebarProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = searchQuery
    ? projects.filter((project) =>
        project.displayPath
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : projects;

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
      className="flex flex-col h-full border-r"
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        background: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}
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
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center" style={{ color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center" style={{ color: "var(--text-muted)" }}>
            No projects found
          </div>
        ) : (
          filtered.map((project) => (
            <ProjectGroup
              key={project.dirName}
              project={project}
              selected={selected}
              onSelect={onSelect}
              customTitles={customTitles}
              onTitleChange={onTitleChange}
              refreshKey={refreshKey}
              runningSessions={runningSessions}
              showArchived={showArchived}
            />
          ))
        )}
      </div>
      <BuddyWidget refreshKey={refreshKey} />
    </aside>
  );
}
