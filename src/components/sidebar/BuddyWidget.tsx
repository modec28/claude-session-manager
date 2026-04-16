import { useEffect, useState } from "react";
import { refreshBuddy, type BuddyState } from "../../api";

const XP_PER_LEVEL = 100;

interface BuddyWidgetProps {
  refreshKey: number;
}

export default function BuddyWidget({ refreshKey }: BuddyWidgetProps) {
  const [buddy, setBuddy] = useState<BuddyState | null>(null);

  useEffect(() => {
    refreshBuddy().then(setBuddy).catch(console.error);
  }, [refreshKey]);

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
            className="w-10 h-10 rounded-full shrink-0"
            style={{ border: "2px solid var(--border-color)" }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-muted)",
            }}
          >
            ?
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-bold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              Lv.{buddy.level} {buddy.githubUsername ?? "Unknown"}
            </span>
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
