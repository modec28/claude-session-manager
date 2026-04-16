import { useState } from "react";

interface ThinkingBlockProps {
  thinking: string;
}

export default function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded p-2"
      style={{
        background: "rgba(203, 166, 247, 0.06)",
        borderLeft: "2px solid var(--accent-mauve)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[10px] font-bold" style={{ color: "var(--accent-mauve)" }}>
          Thinking
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {expanded ? "[-]" : `[+] ${thinking.length} chars`}
        </span>
      </button>
      {expanded && (
        <pre
          className="mt-2 p-2 rounded text-[10px] overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-words"
          style={{
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
          }}
        >
          {thinking}
        </pre>
      )}
    </div>
  );
}
