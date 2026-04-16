import { useCallback, useEffect, useState } from "react";
import type { SelectedSession } from "./types";
import { fetchCustomTitles, setSessionTitle } from "./api";
import Sidebar from "./components/sidebar/Sidebar";
import SessionView from "./components/session/SessionView";

export default function App() {
  const [selected, setSelected] = useState<SelectedSession | null>(null);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchCustomTitles().then(setCustomTitles).catch(console.error);
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
      <Sidebar
        selected={selected}
        onSelect={setSelected}
        customTitles={customTitles}
        onTitleChange={handleTitleChange}
        refreshKey={refreshKey}
      />
      <main className="flex-1 min-w-0">
        {selected ? (
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
              <div className="text-xs">Select a session from the sidebar</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
