import { useEffect, useRef, useState } from "react";
import { fetchSession, resumeInIterm, deleteSession } from "../../api";
import type { ConversationMessage, SelectedSession } from "../../types";
import type { ArchiveJob } from "../../App";
import MessageBubble from "./MessageBubble";
import TerminalPanel from "../terminal/TerminalPanel";

interface SessionViewProps {
  selected: SelectedSession;
  customTitle: string | null;
  onTitleChange: (sessionId: string, title: string) => Promise<void>;
  onSessionDeleted: () => void;
  onArchive: (projectDirName: string, sessionId: string, cwd: string, title: string) => void;
  onResumed: (sessionId: string) => void;
  onStopped: (sessionId: string) => void;
  archiveJob: ArchiveJob | null;
}

export default function SessionView({
  selected,
  customTitle,
  onTitleChange,
  onSessionDeleted,
  onArchive,
  onResumed,
  onStopped,
  archiveJob,
}: SessionViewProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSidechain, setShowSidechain] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    setTerminalOpen(false);
    setTerminalId(null);
    fetchSession(selected.projectDirName, selected.sessionId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected.projectDirName, selected.sessionId]);

  useEffect(() => {
    if (archiveJob?.status === "error" && archiveJob.error) {
      setErrorMessage(archiveJob.error);
    }
  }, [archiveJob]);

  const visibleMessages = showSidechain
    ? messages
    : messages.filter((msg) => !msg.isSidechain);

  const handleOpenTerminal = () => {
    const newId = `term-${selected.sessionId}-${Date.now()}`;
    setTerminalId(newId);
    setTerminalOpen(true);
    onResumed(selected.sessionId);
  };

  const handleOpenInIterm = async () => {
    setErrorMessage(null);
    const cwd = selected.cwd || "/";
    try {
      await resumeInIterm(cwd, selected.sessionId);
      onResumed(selected.sessionId);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const displayTitle = customTitle || selected.sessionId.slice(0, 8) + "...";
  const isArchiving = archiveJob?.status === "archiving";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editingTitle) return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const code = event.code;

      if ((event.metaKey || event.ctrlKey) && event.key === "`") {
        event.preventDefault();
        if (terminalOpen) {
          setTerminalOpen(false);
          setTerminalId(null);
        } else {
          handleOpenTerminal();
        }
        return;
      }

      if (code === "KeyA" && !isArchiving) {
        event.preventDefault();
        onArchive(selected.projectDirName, selected.sessionId, selected.cwd || "/", displayTitle);
      } else if (code === "KeyD" && !confirmingDelete) {
        event.preventDefault();
        setConfirmingDelete(true);
      } else if (code === "KeyY" && confirmingDelete) {
        event.preventDefault();
        handleForceDelete();
      } else if ((event.key === "Escape" || code === "KeyN") && confirmingDelete) {
        event.preventDefault();
        setConfirmingDelete(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, confirmingDelete, editingTitle, isArchiving]);

  const handleDeleteClick = () => {
    setConfirmingDelete(true);
  };

  const handleArchive = () => {
    onArchive(selected.projectDirName, selected.sessionId, selected.cwd || "/", displayTitle);
  };

  const handleForceDelete = async () => {
    setConfirmingDelete(false);
    setErrorMessage(null);
    try {
      await deleteSession(selected.projectDirName, selected.sessionId);
      onSessionDeleted();
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const handleStartRename = () => {
    setEditingTitle(true);
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.value = customTitle || "";
        titleInputRef.current.focus();
      }
    }, 0);
  };

  const handleTitleSubmit = async () => {
    const value = titleInputRef.current?.value.trim() ?? "";
    await onTitleChange(selected.sessionId, value);
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
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
            <div className="flex items-center gap-1">
              <input
                ref={titleInputRef}
                defaultValue={customTitle || ""}
                onKeyDown={handleTitleKeyDown}
                placeholder="Enter session title..."
                className="flex-1 text-xs font-bold px-1 py-0.5 rounded outline-none"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--accent-blue)",
                }}
              />
              <button
                onClick={handleTitleSubmit}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--accent-blue)", color: "var(--bg-primary)" }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs font-bold truncate"
                style={{ color: "var(--text-primary)" }}
                title={displayTitle}
              >
                {displayTitle}
              </span>
              <span
                className="text-[9px] font-mono shrink-0"
                style={{ color: "var(--text-muted)" }}
                title={selected.sessionId}
              >
                {selected.sessionId.slice(0, 8)}
              </span>
              <button
                onClick={handleStartRename}
                className="text-[10px] px-1 py-0.5 rounded shrink-0 hover:opacity-70"
                style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
              >
                Rename
              </button>
            </div>
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
            onClick={handleOpenTerminal}
            className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent-green)",
              color: "var(--bg-primary)",
            }}
          >
            Terminal
          </button>
          <button
            onClick={handleOpenInIterm}
            className="px-2 py-1 rounded text-[10px] font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
            }}
            title="Open in external iTerm2"
          >
            iTerm2
          </button>
          {isArchiving ? (
            <span
              className="px-3 py-1 rounded text-xs font-medium"
              style={{
                background: "var(--bg-surface)",
                color: "var(--accent-peach)",
              }}
            >
              Archiving...
            </span>
          ) : (
            <button
              onClick={handleArchive}
              className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--accent-blue)",
                color: "var(--bg-primary)",
              }}
            >
              Archive
            </button>
          )}
          {confirmingDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleForceDelete}
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
      <div
        className="overflow-y-auto p-4 space-y-3"
        style={{ flex: terminalOpen ? "1 1 50%" : "1 1 100%", minHeight: 0 }}
      >
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
      {terminalOpen && terminalId && (
        <div style={{ flex: "1 1 50%", minHeight: 0 }}>
          <TerminalPanel
            terminalId={terminalId}
            cwd={selected.cwd || "/"}
            command={`claude --resume ${selected.sessionId}`}
            onClose={() => {
              setTerminalOpen(false);
              setTerminalId(null);
              onStopped(selected.sessionId);
            }}
          />
        </div>
      )}
    </div>
  );
}
