import { useState } from "react";

interface ToolUseBlockProps {
  name: string;
  input: unknown;
}

const TOOL_COLORS: Record<string, string> = {
  Read: "var(--accent-blue)",
  Write: "var(--accent-green)",
  Edit: "var(--accent-peach)",
  Bash: "var(--accent-red)",
  Grep: "var(--accent-mauve)",
  Glob: "var(--accent-mauve)",
  Agent: "var(--accent-peach)",
};

const FALLBACK_TOOL_COLOR = "var(--text-muted)";
const SUMMARY_PREVIEW_LENGTH = 120;

function toolSummary(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const record = input as Record<string, unknown>;

  switch (name) {
    case "Read":
      return String(record.file_path ?? "");
    case "Write":
      return String(record.file_path ?? "");
    case "Edit":
      return String(record.file_path ?? "");
    case "Bash":
      return String(record.command ?? "").slice(0, SUMMARY_PREVIEW_LENGTH);
    case "Grep":
      return `/${record.pattern ?? ""}/ in ${record.path ?? "."}`;
    case "Glob":
      return String(record.pattern ?? "");
    case "Agent":
      return String(record.description ?? "");
    default:
      return "";
  }
}

export default function ToolUseBlock({ name, input }: ToolUseBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const color = TOOL_COLORS[name] ?? FALLBACK_TOOL_COLOR;
  const summary = toolSummary(name, input);

  return (
    <div
      className="rounded p-2"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: `${color}22`, color }}
        >
          {name}
        </span>
        {summary && (
          <span
            className="text-[10px] truncate flex-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {summary}
          </span>
        )}
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {expanded ? "[-]" : "[+]"}
        </span>
      </button>
      {expanded && (
        <pre
          className="mt-2 p-2 rounded text-[10px] overflow-x-auto max-h-60 overflow-y-auto"
          style={{
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
          }}
        >
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}
