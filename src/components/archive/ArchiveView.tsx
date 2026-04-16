import { useEffect, useState } from "react";
import { fetchArchives, removeArchive, type ArchiveEntry } from "../../api";
import ArchiveCard from "./ArchiveCard";

export default function ArchiveView() {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("");

  const loadArchives = () => {
    setLoading(true);
    fetchArchives()
      .then(setArchives)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadArchives();
  }, []);

  const projects = [...new Set(archives.map((a) => a.project))].sort();

  const filtered = archives.filter((archive) => {
    if (projectFilter && archive.project !== projectFilter) return false;
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      archive.title.toLowerCase().includes(query) ||
      archive.summary.toLowerCase().includes(query) ||
      archive.tasks.some((t) => t.toLowerCase().includes(query)) ||
      archive.tags.some((t) => t.toLowerCase().includes(query)) ||
      archive.issueKeys.some((k) => k.toLowerCase().includes(query)) ||
      archive.filesChanged.some((f) => f.toLowerCase().includes(query)) ||
      archive.decisions.some((d) => d.toLowerCase().includes(query))
    );
  });

  const handleDelete = async (filename: string) => {
    await removeArchive(filename);
    loadArchives();
  };

  const groupedByDate = filtered.reduce<Record<string, ArchiveEntry[]>>(
    (acc, entry) => {
      const date = entry.timestamp.slice(0, 10) || "Unknown";
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col h-full">
      <header
        className="px-4 py-3 border-b shrink-0"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-xs font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Work Archive
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {filtered.length} entries
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search archives..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="flex-1 px-2 py-1.5 rounded text-xs outline-none"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
            }}
          />
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="px-2 py-1.5 rounded text-xs outline-none"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div
            className="text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Loading archives...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="text-sm mb-2">No archives yet</div>
            <div className="text-[10px]">
              Run <code>/summarize-session</code> in Claude Code to create your
              first archive
            </div>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, entries]) => (
            <div key={date} className="mb-4">
              <div
                className="text-[10px] font-bold mb-2 sticky top-0 py-1"
                style={{
                  color: "var(--accent-blue)",
                  background: "var(--bg-primary)",
                }}
              >
                {date}
              </div>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <ArchiveCard
                    key={entry.filename}
                    entry={entry}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
