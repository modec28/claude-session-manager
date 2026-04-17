import { useEffect, useState } from "react";
import { fetchArchives, type ArchiveEntry } from "../../api";

interface ProjectHistory {
  project: string;
  period: string;
  sessions: ArchiveEntry[];
  allTasks: string[];
  allDecisions: string[];
  allFiles: string[];
  allTags: string[];
  issueKeys: string[];
}

function formatPeriod(startDate: string, endDate: string): string {
  if (!startDate) return "";
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  if (start === end) return start;
  return `${start} ~ ${end}`;
}

function buildProjectHistories(archives: ArchiveEntry[]): ProjectHistory[] {
  const projectMap: Record<string, ArchiveEntry[]> = {};

  for (const entry of archives) {
    const project = entry.project || "unknown";
    if (!projectMap[project]) projectMap[project] = [];
    projectMap[project].push(entry);
  }

  const histories: ProjectHistory[] = [];

  for (const [project, sessions] of Object.entries(projectMap)) {
    const sorted = [...sessions].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );

    const allTasks = sorted.flatMap((session) => session.tasks);
    const allDecisions = sorted.flatMap((session) => session.decisions);
    const allFiles = [
      ...new Set(sorted.flatMap((session) => session.filesChanged)),
    ];
    const allTags = [...new Set(sorted.flatMap((session) => session.tags))];
    const issueKeys = [
      ...new Set(sorted.flatMap((session) => session.issueKeys)),
    ];

    const startDate = sorted[0]?.startDate ?? "";
    const endDate = sorted[sorted.length - 1]?.endDate ?? "";

    histories.push({
      project,
      period: formatPeriod(startDate, endDate),
      sessions: sorted,
      allTasks,
      allDecisions,
      allFiles,
      allTags,
      issueKeys,
    });
  }

  histories.sort((a, b) => {
    const aStart = a.sessions[0]?.startDate ?? "";
    const bStart = b.sessions[0]?.startDate ?? "";
    return bStart.localeCompare(aStart);
  });

  return histories;
}

export default function HistoryView() {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchives()
      .then(setArchives)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const histories = buildProjectHistories(archives);

  const totalProjects = histories.length;
  const totalSessions = archives.length;
  const dateRange =
    archives.length > 0
      ? formatPeriod(
          [...archives].sort((a, b) =>
            a.startDate.localeCompare(b.startDate),
          )[0]?.startDate ?? "",
          [...archives].sort((a, b) =>
            b.startDate.localeCompare(a.startDate),
          )[0]?.endDate ?? "",
        )
      : "";

  return (
    <div className="flex flex-col h-full">
      <header
        className="px-6 py-4 border-b shrink-0"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        <div
          className="text-sm font-bold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Work History
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {dateRange} | {totalProjects} projects | {totalSessions} sessions
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div
            className="text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Loading...
          </div>
        ) : histories.length === 0 ? (
          <div
            className="text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="text-sm mb-2">No work history yet</div>
            <div className="text-[10px]">
              Archive sessions to build your work history
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {histories.map((history) => (
              <ProjectSection key={history.project} history={history} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectSection({ history }: { history: ProjectHistory }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {history.project}
              </span>
              {history.issueKeys.map((key) => (
                <span
                  key={key}
                  className="text-[10px] px-1.5 rounded"
                  style={{
                    background: "rgba(203, 166, 247, 0.15)",
                    color: "var(--accent-mauve)",
                  }}
                >
                  {key}
                </span>
              ))}
            </div>
            <div
              className="text-[10px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {history.period} | {history.sessions.length} sessions
            </div>
          </div>
          <div className="flex gap-1 flex-wrap shrink-0">
            {history.allTags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-muted)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div
            className="text-[10px] font-bold mb-1.5"
            style={{ color: "var(--accent-green)" }}
          >
            Tasks
          </div>
          <ul className="space-y-1">
            {history.allTasks.map((task, index) => (
              <li
                key={index}
                className="text-[11px] pl-3 leading-relaxed"
                style={{
                  color: "var(--text-secondary)",
                  listStyle: "disc inside",
                }}
              >
                {task}
              </li>
            ))}
          </ul>
        </div>
      </button>

      {expanded && (
        <div
          className="mt-3 pt-3 space-y-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          {history.allDecisions.length > 0 && (
            <div>
              <div
                className="text-[10px] font-bold mb-1.5"
                style={{ color: "var(--accent-mauve)" }}
              >
                Key Decisions
              </div>
              <ul className="space-y-1">
                {history.allDecisions.map((decision, index) => (
                  <li
                    key={index}
                    className="text-[11px] pl-3 leading-relaxed"
                    style={{
                      color: "var(--text-secondary)",
                      listStyle: "disc inside",
                    }}
                  >
                    {decision}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history.allFiles.length > 0 && (
            <div>
              <div
                className="text-[10px] font-bold mb-1.5"
                style={{ color: "var(--accent-peach)" }}
              >
                Files Changed
              </div>
              <div className="flex flex-wrap gap-1">
                {history.allFiles.map((file) => (
                  <span
                    key={file}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div
              className="text-[10px] font-bold mb-1.5"
              style={{ color: "var(--accent-blue)" }}
            >
              Session Timeline
            </div>
            <div className="space-y-1.5">
              {history.sessions.map((session) => (
                <div
                  key={session.filename}
                  className="flex items-start gap-2 text-[10px]"
                >
                  <span
                    className="shrink-0 font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {session.startDate.slice(0, 10)}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {session.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
