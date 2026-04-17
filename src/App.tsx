import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedSession } from "./types";
import {
  fetchCustomTitles,
  setSessionTitle,
  archiveAndDelete,
  fetchSessionFileSize,
} from "./api";
import Sidebar from "./components/sidebar/Sidebar";
import SessionView from "./components/session/SessionView";
import ArchiveView from "./components/archive/ArchiveView";
import HistoryView from "./components/history/HistoryView";
import TerminalPanel from "./components/terminal/TerminalPanel";
import VersionInfo from "./components/nav/VersionInfo";

type AppTab = "sessions" | "archive" | "history";

export interface ArchiveJob {
  sessionId: string;
  status: "archiving" | "done" | "error";
  error?: string;
  startedAt: number;
  fileSizeKb: number;
  title: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("sessions");
  const [selected, setSelected] = useState<SelectedSession | null>(null);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [runningSessions, setRunningSessions] = useState<Set<string>>(new Set());
  const [archiveJobs, setArchiveJobs] = useState<Record<string, ArchiveJob>>({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [standaloneTerminal, setStandaloneTerminal] = useState<{
    terminalId: string;
    cwd: string;
    command: string;
  } | null>(null);
  const [sessionTerminals, setSessionTerminals] = useState<
    Record<string, { terminalId: string; cwd: string; command: string }>
  >({});

  useEffect(() => {
    fetchCustomTitles().then(setCustomTitles).catch(console.error);
  }, []);

  const TAB_ORDER: AppTab[] = ["sessions", "archive", "history"];

  useEffect(() => {
    const handleGlobalKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (event.key === "Tab" && !isInput) {
        event.preventDefault();
        setActiveTab((prev) => {
          const currentIndex = TAB_ORDER.indexOf(prev);
          const nextIndex = event.shiftKey
            ? (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length
            : (currentIndex + 1) % TAB_ORDER.length;
          return TAB_ORDER[nextIndex];
        });
      } else if ((event.metaKey || event.ctrlKey) && event.code === "KeyB") {
        event.preventDefault();
        setSidebarVisible((prev) => !prev);
      } else if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        setActiveTab((currentTab) => {
          if (currentTab === "archive") {
            setTimeout(() => document.getElementById("archive-search")?.focus(), 0);
          } else {
            setTimeout(() => document.getElementById("sidebar-search")?.focus(), 0);
          }
          return currentTab;
        });
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);

  const [newSessionModal, setNewSessionModal] = useState<{ cwd: string } | null>(null);

  const handleNewTerminalRequest = useCallback((cwd: string) => {
    setNewSessionModal({ cwd });
  }, []);

  const handleNewTerminalConfirm = useCallback((cwd: string, name: string) => {
    const terminalId = `new-term-${Date.now()}`;
    const nameFlag = name ? ` --name "${name}"` : "";
    setStandaloneTerminal({ terminalId, cwd, command: `claude${nameFlag}` });
    setSelected(null);
    setActiveTab("sessions");
    setNewSessionModal(null);
  }, []);

  const markSessionRunning = useCallback((sessionId: string) => {
    setRunningSessions((prev) => new Set([...prev, sessionId]));
  }, []);

  const markSessionStopped = useCallback((sessionId: string) => {
    setRunningSessions((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const openSessionTerminal = useCallback(
    (sessionId: string, cwd: string) => {
      setSessionTerminals((prev) => {
        if (prev[sessionId]) return prev;
        return {
          ...prev,
          [sessionId]: {
            terminalId: `term-${sessionId}-${Date.now()}`,
            cwd: cwd || "/",
            command: `claude --resume ${sessionId}`,
          },
        };
      });
      markSessionRunning(sessionId);
    },
    [markSessionRunning],
  );

  const closeSessionTerminal = useCallback(
    (sessionId: string) => {
      setSessionTerminals((prev) => {
        if (!prev[sessionId]) return prev;
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      markSessionStopped(sessionId);
    },
    [markSessionStopped],
  );


  const handleTitleChange = useCallback(
    async (sessionId: string, title: string) => {
      await setSessionTitle(sessionId, title);
      setCustomTitles((prev) => {
        const next = { ...prev };
        if (title) {
          next[sessionId] = title;
        } else {
          delete next[sessionId];
        }
        return next;
      });
    },
    [],
  );

  const handleSessionDeleted = useCallback(() => {
    setSelected(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleArchive = useCallback(
    async (projectDirName: string, sessionId: string, cwd: string, title: string) => {
      const fileSizeKb = await fetchSessionFileSize(projectDirName, sessionId).catch(() => 0);
      setArchiveJobs((prev) => ({
        ...prev,
        [sessionId]: { sessionId, status: "archiving", startedAt: Date.now(), fileSizeKb, title },
      }));

      try {
        await archiveAndDelete(projectDirName, sessionId, cwd);
        setArchiveJobs((prev) => ({
          ...prev,
          [sessionId]: { ...prev[sessionId], status: "done" },
        }));
        setRefreshKey((prev) => prev + 1);
      } catch (error) {
        setArchiveJobs((prev) => ({
          ...prev,
          [sessionId]: { ...prev[sessionId], status: "error", error: String(error) },
        }));
      }
    },
    [],
  );

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-primary)" }}>
      <div style={{ display: sidebarVisible ? "flex" : "none" }}>
        <Sidebar
          selected={selected}
          onSelect={(session) => { setSelected(session); setStandaloneTerminal(null); }}
          onNewTerminal={handleNewTerminalRequest}
          customTitles={customTitles}
          refreshKey={refreshKey}
          runningSessions={runningSessions}
        />
      </div>
      <button
        onClick={() => setSidebarVisible((prev) => !prev)}
        className="shrink-0 flex items-center justify-center w-4 hover:opacity-70 transition-opacity"
        style={{
          background: "var(--bg-secondary)",
          color: "var(--text-muted)",
          borderRight: sidebarVisible ? "none" : "1px solid var(--border-color)",
          borderLeft: sidebarVisible ? "1px solid var(--border-color)" : "none",
          fontSize: "10px",
        }}
        title={`${sidebarVisible ? "Hide" : "Show"} sidebar (Cmd+B)`}
      >
        {sidebarVisible ? "\u25C0" : "\u25B6"}
      </button>
      <div className="flex flex-col flex-1 min-w-0">
        <nav
          className="flex items-center gap-0 shrink-0 border-b"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <TabButton
            label="Sessions"
            active={activeTab === "sessions"}
            onClick={() => setActiveTab("sessions")}
          />
          <TabButton
            label="Archive"
            active={activeTab === "archive"}
            onClick={() => setActiveTab("archive")}
          />
          <TabButton
            label="History"
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
          />
          <ArchiveStatus jobs={archiveJobs} />
          <div className="flex-1" />
          <VersionInfo />
          <HelpTooltip />
        </nav>
        <div className="flex-1 flex flex-col min-h-0">
          {(() => {
            const activeTerminal =
              activeTab === "sessions" && selected
                ? sessionTerminals[selected.sessionId]
                : null;
            const hasActiveTerminal = !!activeTerminal;
            return (
              <>
                <div
                  style={{
                    flex: hasActiveTerminal ? "1 1 50%" : "1 1 100%",
                    minHeight: 0,
                  }}
                >
                  {activeTab === "sessions" ? (
                    selected ? (
                      <SessionView
                        selected={selected}
                        customTitle={customTitles[selected.sessionId] ?? null}
                        onTitleChange={handleTitleChange}
                        onSessionDeleted={handleSessionDeleted}
                        onArchive={handleArchive}
                        hasTerminal={!!sessionTerminals[selected.sessionId]}
                        onOpenTerminal={openSessionTerminal}
                        onCloseTerminal={closeSessionTerminal}
                        archiveJob={archiveJobs[selected.sessionId] ?? null}
                      />
                    ) : standaloneTerminal ? (
                      <TerminalPanel
                        terminalId={standaloneTerminal.terminalId}
                        cwd={standaloneTerminal.cwd}
                        command={standaloneTerminal.command}
                        onClose={() => setStandaloneTerminal(null)}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center h-full"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-2">Claude Session Manager</div>
                          <div className="text-xs">
                            Select a session from the sidebar
                          </div>
                        </div>
                      </div>
                    )
                  ) : activeTab === "archive" ? (
                    <ArchiveView />
                  ) : (
                    <HistoryView />
                  )}
                </div>
                <div
                  style={{
                    flex: hasActiveTerminal ? "1 1 50%" : "0 0 0",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  {Object.entries(sessionTerminals).map(([sid, term]) => (
                    <div
                      key={term.terminalId}
                      style={{
                        height: "100%",
                        display:
                          activeTab === "sessions" && selected?.sessionId === sid
                            ? "block"
                            : "none",
                      }}
                    >
                      <TerminalPanel
                        terminalId={term.terminalId}
                        cwd={term.cwd}
                        command={term.command}
                        onClose={() => closeSessionTerminal(sid)}
                      />
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>
      {newSessionModal && (
        <NewSessionModal
          cwd={newSessionModal.cwd}
          onConfirm={handleNewTerminalConfirm}
          onCancel={() => setNewSessionModal(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-xs font-medium transition-colors"
      style={{
        color: active ? "var(--accent-blue)" : "var(--text-muted)",
        borderBottom: active
          ? "2px solid var(--accent-blue)"
          : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}

function ArchiveStatus({ jobs }: { jobs: Record<string, ArchiveJob> }) {
  const activeJobs = Object.values(jobs).filter((j) => j.status === "archiving");
  const errorJobs = Object.values(jobs).filter((j) => j.status === "error");
  const [, setTick] = useState(0);

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeJobs.length]);

  if (activeJobs.length === 0 && errorJobs.length === 0) return null;

  return (
    <div className="ml-auto mr-3 flex flex-col gap-0.5 text-[10px] px-2 py-1 rounded">
      {activeJobs.map((job) => {
        const elapsed = Math.floor((Date.now() - job.startedAt) / 1000);
        const sizeLabel = job.fileSizeKb >= 1024
          ? `${(job.fileSizeKb / 1024).toFixed(1)}MB`
          : `${job.fileSizeKb}KB`;
        return (
          <div
            key={job.sessionId}
            style={{ color: "var(--accent-peach)" }}
          >
            {job.title || job.sessionId.slice(0, 8)} ({sizeLabel}) {elapsed}s
          </div>
        );
      })}
      {errorJobs.map((job) => (
        <div
          key={job.sessionId}
          style={{ color: "var(--accent-red)" }}
          title={job.error}
        >
          {job.title || job.sessionId.slice(0, 8)} failed
        </div>
      ))}
    </div>
  );
}

function HelpTooltip() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mr-3">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-80"
        style={{
          background: "var(--accent-blue)",
          color: "var(--bg-primary)",
        }}
      >
        ?
      </button>
      {visible && (
        <div
          className="absolute right-0 top-7 z-50 p-3 rounded-lg shadow-lg text-[10px] whitespace-nowrap"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <div className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Keyboard Shortcuts
          </div>
          <table className="border-separate" style={{ borderSpacing: "8px 4px" }}>
            <tbody>
              <tr><td style={{ color: "var(--accent-blue)" }}>Tab / Shift+Tab</td><td>Switch tabs</td></tr>
              <tr><td style={{ color: "var(--accent-blue)" }}>Cmd+B</td><td>Toggle sidebar</td></tr>
              <tr><td style={{ color: "var(--accent-blue)" }}>Cmd+F</td><td>Search (Archive tab)</td></tr>
              <tr><td colSpan={2} className="pt-2 font-bold" style={{ color: "var(--text-primary)" }}>Terminal</td></tr>
              <tr><td style={{ color: "var(--accent-green)" }}>Cmd+`</td><td>Toggle terminal</td></tr>
              <tr><td colSpan={2} className="pt-2 font-bold" style={{ color: "var(--text-primary)" }}>Session View</td></tr>
              <tr><td style={{ color: "var(--accent-green)" }}>A / ㅁ</td><td>Archive</td></tr>
              <tr><td style={{ color: "var(--accent-red)" }}>D / ㅇ</td><td>Delete</td></tr>
              <tr><td style={{ color: "var(--accent-green)" }}>Y / ㅛ</td><td>Confirm delete</td></tr>
              <tr><td style={{ color: "var(--accent-peach)" }}>N / ㅜ / Esc</td><td>Cancel delete</td></tr>
              <tr><td colSpan={2} className="pt-2 font-bold" style={{ color: "var(--text-primary)" }}>Sidebar</td></tr>
              <tr><td style={{ color: "var(--accent-blue)" }}>Up / Down</td><td>Navigate</td></tr>
              <tr><td style={{ color: "var(--accent-blue)" }}>Enter / Right</td><td>Select / Expand</td></tr>
              <tr><td style={{ color: "var(--accent-blue)" }}>Left</td><td>Collapse / Parent</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewSessionModal({
  cwd,
  onConfirm,
  onCancel,
}: {
  cwd: string;
  onConfirm: (cwd: string, name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    onConfirm(cwd, inputRef.current?.value.trim() ?? "");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") handleSubmit();
    else if (event.key === "Escape") onCancel();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg p-4 w-80"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="text-xs font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          New Session
        </div>
        <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
          Session Name (optional)
        </div>
        <input
          ref={inputRef}
          placeholder="e.g. feature/login-page"
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1.5 rounded text-xs outline-none mb-3"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-color)",
          }}
        />
        <div className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
          Working directory: {cwd}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded text-xs transition-opacity hover:opacity-80"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent-green)",
              color: "var(--bg-primary)",
            }}
          >
            Open Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
