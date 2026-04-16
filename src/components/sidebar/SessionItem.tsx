import { useState } from "react";
import type { SelectedSession, SessionInfo } from "../../types";

interface SessionItemProps {
  session: SessionInfo;
  projectDirName: string;
  isSelected: boolean;
  onSelect: (session: SelectedSession) => void;
  customTitle: string | null;
  onTitleChange: (sessionId: string, title: string) => Promise<void>;
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

export default function SessionItem({
  session,
  projectDirName,
  isSelected,
  onSelect,
  customTitle,
  onTitleChange,
}: SessionItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const displayTitle = customTitle || session.title;

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEditValue(displayTitle);
    setEditing(true);
  };

  const handleSubmit = async () => {
    const trimmed = editValue.trim();
    await onTitleChange(session.sessionId, trimmed);
    setEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSubmit();
    } else if (event.key === "Escape") {
      setEditing(false);
    }
  };

  return (
    <button
      onClick={() =>
        onSelect({
          projectDirName,
          sessionId: session.sessionId,
          cwd: session.cwd,
        })
      }
      className="w-full flex flex-col gap-0.5 px-3 py-1.5 text-left rounded-sm transition-colors"
      style={{
        background: isSelected ? "var(--bg-surface)" : "transparent",
        borderLeft: isSelected
          ? "2px solid var(--accent-blue)"
          : "2px solid transparent",
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          onClick={(event) => event.stopPropagation()}
          className="text-xs w-full px-1 py-0.5 rounded outline-none"
          style={{
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--accent-blue)",
          }}
        />
      ) : (
        <span
          onDoubleClick={handleDoubleClick}
          className="text-xs truncate w-full"
          style={{
            color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
          }}
          title="Double-click to rename"
        >
          {displayTitle}
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {formatTimestamp(session.timestamp)}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
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
      </div>
    </button>
  );
}
