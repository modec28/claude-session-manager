import { useEffect, useRef, useState } from "react";
import { refreshBuddy, type BuddyState } from "../../api";
import { invoke } from "@tauri-apps/api/core";

const XP_PER_LEVEL = 100;

interface BuddyWidgetProps {
  refreshKey: number;
}

export default function BuddyWidget({ refreshKey }: BuddyWidgetProps) {
  const [buddy, setBuddy] = useState<BuddyState | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshBuddy().then(setBuddy).catch(console.error);
  }, [refreshKey]);

  const handleUsernameSubmit = async () => {
    const value = usernameInputRef.current?.value.trim() ?? "";
    if (value) {
      await invoke("set_buddy_username", { username: value }).catch(console.error);
      refreshBuddy().then(setBuddy).catch(console.error);
    }
    setEditingUsername(false);
  };

  const handleStartEdit = () => {
    setEditingUsername(true);
    setTimeout(() => {
      if (usernameInputRef.current) {
        usernameInputRef.current.value = buddy?.githubUsername ?? "";
        usernameInputRef.current.focus();
      }
    }, 0);
  };

  if (!buddy) return null;

  const xpPercent = Math.min((buddy.xp / XP_PER_LEVEL) * 100, 100);

  return (
    <div
      className="p-3 border-t"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex items-center gap-3">
        {buddy.avatarUrl ? (
          <img
            src={buddy.avatarUrl}
            onClick={handleStartEdit}
            className="w-10 h-10 rounded-full shrink-0 cursor-pointer hover:opacity-80"
            style={{ border: "2px solid var(--border-color)" }}
            title="Click to change username"
          />
        ) : (
          <div
            onClick={handleStartEdit}
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm cursor-pointer hover:opacity-80"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-muted)",
            }}
            title="Click to set username"
          >
            ?
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            {editingUsername ? (
              <div className="flex items-center gap-1">
                <input
                  ref={usernameInputRef}
                  defaultValue={buddy.githubUsername ?? ""}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") handleUsernameSubmit();
                    else if (event.key === "Escape") setEditingUsername(false);
                  }}
                  placeholder="GitHub username"
                  className="text-[10px] px-1 py-0.5 rounded outline-none w-20"
                  style={{
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--accent-blue)",
                  }}
                />
                <button
                  onClick={handleUsernameSubmit}
                  className="text-[9px] px-1 rounded"
                  style={{ background: "var(--accent-blue)", color: "var(--bg-primary)" }}
                >
                  OK
                </button>
              </div>
            ) : (
              <span
                className="text-[10px] font-bold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                Lv.{buddy.level} {buddy.githubUsername ?? "Unknown"}
              </span>
            )}
          </div>
          <div
            className="mt-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-primary)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${xpPercent}%`,
                background: "var(--accent-green)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              XP {buddy.xp}/{XP_PER_LEVEL}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {buddy.totalArchives} archived / {buddy.totalSessions} sessions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
