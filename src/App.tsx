import { useCallback, useEffect, useState } from "react";
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

  const markSessionRunning = useCallback((sessionId: string) => {
    setRunningSessions((prev) => new Set([...prev, sessionId]));
  }, []);


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
          onSelect={setSelected}
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
          <HelpTooltip />
        </nav>
        <div className="flex-1 min-h-0">
          {activeTab === "sessions" ? (
            selected ? (
              <SessionView
                selected={selected}
                customTitle={customTitles[selected.sessionId] ?? null}
                onTitleChange={handleTitleChange}
                onSessionDeleted={handleSessionDeleted}
                onArchive={handleArchive}
                onResumed={markSessionRunning}
                archiveJob={archiveJobs[selected.sessionId] ?? null}
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
      </div>
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
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text-muted)",
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
