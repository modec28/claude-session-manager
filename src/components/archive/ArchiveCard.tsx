import { useState } from "react";
import type { ArchiveEntry } from "../../api";

interface ArchiveCardProps {
  entry: ArchiveEntry;
  onDelete: (filename: string) => Promise<void>;
}

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate) return "";
  try {
    const fmt = (ts: string) =>
      new Date(ts).toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    const start = fmt(startDate);
    if (!endDate || startDate === endDate) return start;
    const startDay = startDate.slice(0, 10);
    const endDay = endDate.slice(0, 10);
    if (startDay === endDay) {
      const endTime = new Date(endDate).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${start} ~ ${endTime}`;
    }
    return `${start} ~ ${fmt(endDate)}`;
  } catch {
    return startDate;
  }
}

export default function ArchiveCard({ entry, onDelete }: ArchiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {entry.title || "Untitled"}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {formatDateRange(entry.startDate, entry.endDate)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-[10px] px-1.5 rounded"
              style={{
                background: "var(--bg-surface)",
                color: "var(--accent-blue)",
              }}
            >
              {entry.project}
            </span>
            {entry.branch && (
              <span
                className="text-[10px] px-1.5 rounded"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--accent-green)",
                }}
              >
                {entry.branch}
              </span>
            )}
            {entry.issueKeys.map((key) => (
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
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1 rounded"
                style={{
                  background: "var(--bg-hover)",
                  color: "var(--text-muted)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <div
            className="text-[11px] mt-1.5 line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {entry.summary}
          </div>
        </button>
        <div className="shrink-0">
          {confirmingDelete ? (
            <div className="flex gap-1">
              <button
                onClick={() => onDelete(entry.filename)}
                className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{
                  background: "var(--accent-red)",
                  color: "var(--bg-primary)",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              X
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="mt-3 pt-3 space-y-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          {entry.tasks.length > 0 && (
            <div>
              <div
                className="text-[10px] font-bold mb-1"
                style={{ color: "var(--accent-green)" }}
              >
                Tasks
              </div>
              <ul className="space-y-0.5">
                {entry.tasks.map((task, index) => (
                  <li
                    key={index}
                    className="text-[11px] pl-3"
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
          )}

          {entry.filesChanged.length > 0 && (
            <div>
              <div
                className="text-[10px] font-bold mb-1"
                style={{ color: "var(--accent-peach)" }}
              >
                Files Changed
              </div>
              <div className="flex flex-wrap gap-1">
                {entry.filesChanged.map((file) => (
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

          {entry.decisions.length > 0 && (
            <div>
              <div
                className="text-[10px] font-bold mb-1"
                style={{ color: "var(--accent-mauve)" }}
              >
                Decisions
              </div>
              <ul className="space-y-0.5">
                {entry.decisions.map((decision, index) => (
                  <li
                    key={index}
                    className="text-[11px] pl-3"
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
        </div>
      )}
    </div>
  );
}
