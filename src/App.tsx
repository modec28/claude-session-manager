import { useCallback, useEffect, useState } from "react";
import type { SelectedSession } from "./types";
import {
  fetchCustomTitles,
  setSessionTitle,
  fetchRunningSessions,
  archiveAndDelete,
  fetchSessionFileSize,
} from "./api";
import Sidebar from "./components/sidebar/Sidebar";
import SessionView from "./components/session/SessionView";
import ArchiveView from "./components/archive/ArchiveView";

type AppTab = "sessions" | "archive";

const RUNNING_POLL_INTERVAL_MS = 5000;

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

  useEffect(() => {
    fetchCustomTitles().then(setCustomTitles).catch(console.error);
  }, []);

  useEffect(() => {
    const poll = () => {
      fetchRunningSessions()
        .then((ids) => setRunningSessions(new Set(ids)))
        .catch(console.error);
    };
    poll();
    const interval = setInterval(poll, RUNNING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
      {activeTab === "sessions" && (
        <Sidebar
          selected={selected}
          onSelect={setSelected}
          customTitles={customTitles}
          onTitleChange={handleTitleChange}
          refreshKey={refreshKey}
          runningSessions={runningSessions}
        />
      )}
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
          <ArchiveStatus jobs={archiveJobs} />
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
          ) : (
            <ArchiveView />
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
  const [, setTick] = useState(0);

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeJobs.length]);

  if (activeJobs.length === 0) return null;

  return (
    <div
      className="ml-auto mr-3 flex flex-col gap-0.5 text-[10px] px-2 py-1 rounded"
      style={{
        background: "rgba(250, 179, 135, 0.15)",
        color: "var(--accent-peach)",
      }}
    >
      {activeJobs.map((job) => {
        const elapsed = Math.floor((Date.now() - job.startedAt) / 1000);
        const sizeLabel = job.fileSizeKb >= 1024
          ? `${(job.fileSizeKb / 1024).toFixed(1)}MB`
          : `${job.fileSizeKb}KB`;
        return (
          <div key={job.sessionId}>
            {job.title || job.sessionId.slice(0, 8)} ({sizeLabel}) {elapsed}s
          </div>
        );
      })}
    </div>
  );
}
