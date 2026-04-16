import { useEffect, useState } from "react";
import { fetchSession, resumeInIterm, deleteSession } from "../../api";
import type { ConversationMessage, SelectedSession } from "../../types";
import MessageBubble from "./MessageBubble";

interface SessionViewProps {
  selected: SelectedSession;
  customTitle: string | null;
  onTitleChange: (sessionId: string, title: string) => Promise<void>;
  onSessionDeleted: () => void;
}

export default function SessionView({
  selected,
  customTitle,
  onTitleChange,
  onSessionDeleted,
}: SessionViewProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSidechain, setShowSidechain] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    fetchSession(selected.projectDirName, selected.sessionId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected.projectDirName, selected.sessionId]);

  const visibleMessages = showSidechain
    ? messages
    : messages.filter((msg) => !msg.isSidechain);

  const handleResume = async () => {
    setErrorMessage(null);
    const cwd = selected.cwd || "/";
    try {
      await resumeInIterm(cwd, selected.sessionId);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteClick = () => {
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = async () => {
    setConfirmingDelete(false);
    setErrorMessage(null);
    try {
      await deleteSession(selected.projectDirName, selected.sessionId);
      onSessionDeleted();
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const displayTitle = customTitle || selected.sessionId.slice(0, 8) + "...";

  const handleTitleDoubleClick = () => {
    setTitleDraft(customTitle || "");
    setEditingTitle(true);
  };

  const handleTitleSubmit = async () => {
    await onTitleChange(selected.sessionId, titleDraft.trim());
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleTitleSubmit();
    } else if (event.key === "Escape") {
      setEditingTitle(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              placeholder="Enter session title..."
              className="text-xs font-bold px-1 py-0.5 rounded outline-none"
              style={{
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--accent-blue)",
              }}
            />
          ) : (
            <span
              onDoubleClick={handleTitleDoubleClick}
              className="text-xs font-bold cursor-pointer truncate"
              style={{ color: "var(--text-primary)" }}
              title="Double-click to rename"
            >
              {displayTitle}
            </span>
          )}
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {selected.cwd}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label
            className="flex items-center gap-1 text-[10px] cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <input
              type="checkbox"
              checked={showSidechain}
              onChange={(event) => setShowSidechain(event.target.checked)}
              className="w-3 h-3"
            />
            Sidechain
          </label>
          <button
            onClick={handleResume}
            className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent-green)",
              color: "var(--bg-primary)",
            }}
          >
            Resume in iTerm2
          </button>
          {confirmingDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: "var(--accent-red)" }}>
                Delete?
              </span>
              <button
                onClick={handleDeleteConfirm}
                className="px-2 py-1 rounded text-[10px] font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "var(--accent-red)",
                  color: "var(--bg-primary)",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 rounded text-[10px] font-medium transition-opacity hover:opacity-80"
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
              onClick={handleDeleteClick}
              className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--accent-red)",
                color: "var(--bg-primary)",
              }}
            >
              Delete
            </button>
          )}
        </div>
      </header>
      {errorMessage && (
        <div
          className="flex items-start gap-2 mx-4 mt-3 p-3 rounded text-xs"
          style={{
            background: "rgba(243, 139, 168, 0.12)",
            border: "1px solid var(--accent-red)",
            color: "var(--accent-red)",
          }}
        >
          <pre className="flex-1 whitespace-pre-wrap">{errorMessage}</pre>
          <button
            onClick={() => setErrorMessage(null)}
            className="shrink-0 font-bold hover:opacity-70"
          >
            X
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
            Loading session...
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
            No messages found
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <MessageBubble key={msg.uuid} message={msg} />
          ))
        )}
      </div>
    </div>
  );
}
