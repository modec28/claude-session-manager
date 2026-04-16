import { useCallback, useEffect, useState } from "react";
import type { SelectedSession } from "./types";
import { fetchCustomTitles, setSessionTitle, fetchRunningSessions } from "./api";
import Sidebar from "./components/sidebar/Sidebar";
import SessionView from "./components/session/SessionView";
import ArchiveView from "./components/archive/ArchiveView";

type AppTab = "sessions" | "archive";

const RUNNING_POLL_INTERVAL_MS = 5000;

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("sessions");
  const [selected, setSelected] = useState<SelectedSession | null>(null);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [runningSessions, setRunningSessions] = useState<Set<string>>(new Set());

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
        </nav>
        <div className="flex-1 min-h-0">
          {activeTab === "sessions" ? (
            selected ? (
              <SessionView
                selected={selected}
                customTitle={customTitles[selected.sessionId] ?? null}
                onTitleChange={handleTitleChange}
                onSessionDeleted={handleSessionDeleted}
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
