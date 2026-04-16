import { useState } from "react";

interface ToolResultBlockProps {
  content: unknown;
}

function extractResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.type === "text") return item.text ?? "";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    return JSON.stringify(content, null, 2);
  }
  return String(content ?? "");
}

export default function ToolResultBlock({ content }: ToolResultBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const text = extractResultText(content);
  const preview = text.slice(0, 120);
  const hasMore = text.length > 120;

  return (
    <div
      className="rounded p-2"
      style={{
        background: "rgba(108, 112, 134, 0.06)",
        borderLeft: "2px solid var(--text-muted)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left"
      >
        <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--text-muted)" }}>
          Result
        </span>
        {!expanded && (
          <span
            className="text-[10px] truncate flex-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {preview}
            {hasMore && "..."}
          </span>
        )}
        <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
          {expanded ? "[-]" : "[+]"}
        </span>
      </button>
      {expanded && (
        <pre
          className="mt-2 p-2 rounded text-[10px] overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-words"
          style={{
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
          }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}
