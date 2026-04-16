import { useEffect, useState } from "react";
import { refreshBuddy, type BuddyState } from "../../api";

const BUDDY_FACES = ["(*^-^*)", "(*^o^*)", "(*-_-*)", "(;*_*;)", "(>_<|||)"];
const BUDDY_MOODS = ["Fit", "Healthy", "Pudgy", "Chubby", "Overweight"];
const BUDDY_WIDTHS = ["40px", "46px", "52px", "60px", "70px"];

const XP_PER_LEVEL = 50;

interface BuddyWidgetProps {
  refreshKey: number;
}

export default function BuddyWidget({ refreshKey }: BuddyWidgetProps) {
  const [buddy, setBuddy] = useState<BuddyState | null>(null);

  useEffect(() => {
    refreshBuddy().then(setBuddy).catch(console.error);
  }, [refreshKey]);

  if (!buddy) return null;

  const face = BUDDY_FACES[buddy.weightStage] ?? BUDDY_FACES[BUDDY_FACES.length - 1];
  const mood = BUDDY_MOODS[buddy.weightStage] ?? BUDDY_MOODS[BUDDY_MOODS.length - 1];
  const bodyWidth = BUDDY_WIDTHS[buddy.weightStage] ?? BUDDY_WIDTHS[BUDDY_WIDTHS.length - 1];
  const xpPercent = Math.min((buddy.xp / XP_PER_LEVEL) * 100, 100);

  return (
    <div
      className="p-3 border-t"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: bodyWidth,
            height: "40px",
            background: "var(--bg-surface)",
            fontSize: "14px",
            transition: "width 0.3s ease",
          }}
        >
          {face}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>
              Lv.{buddy.level} {mood}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {buddy.totalSessions} sessions
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
                background: buddy.weightStage <= 1
                  ? "var(--accent-green)"
                  : buddy.weightStage <= 2
                    ? "var(--accent-peach)"
                    : "var(--accent-red)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              XP {buddy.xp}/{XP_PER_LEVEL}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {buddy.totalCleanups} cleaned
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
