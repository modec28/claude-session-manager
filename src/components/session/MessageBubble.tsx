import type { ConversationMessage, ContentBlock } from "../../types";
import TextBlock from "./TextBlock";
import ToolUseBlock from "./ToolUseBlock";
import ToolResultBlock from "./ToolResultBlock";
import ThinkingBlock from "./ThinkingBlock";

interface MessageBubbleProps {
  message: ConversationMessage;
}

const ROLE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  user: {
    label: "User",
    color: "var(--accent-blue)",
    bg: "rgba(137, 180, 250, 0.08)",
  },
  assistant: {
    label: "Assistant",
    color: "var(--accent-green)",
    bg: "rgba(166, 227, 161, 0.08)",
  },
  system: {
    label: "System",
    color: "var(--text-muted)",
    bg: "rgba(108, 112, 134, 0.08)",
  },
};

function formatMessageTime(timestamp: string): string {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderContentBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "text":
      return <TextBlock key={index} text={block.text} />;
    case "tool_use":
      return (
        <ToolUseBlock key={index} name={block.name} input={block.input} />
      );
    case "tool_result":
      return <ToolResultBlock key={index} content={block.content} />;
    case "thinking":
      return <ThinkingBlock key={index} thinking={block.thinking} />;
    default:
      return null;
  }
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const style = ROLE_STYLES[message.role] ?? ROLE_STYLES.system;

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: style.bg, border: `1px solid ${style.bg}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold" style={{ color: style.color }}>
          {style.label}
        </span>
        {message.model && (
          <span
            className="text-[10px] px-1 rounded"
            style={{
              background: "var(--bg-surface)",
              color: "var(--accent-mauve)",
            }}
          >
            {message.model.replace("claude-", "")}
          </span>
        )}
        <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
          {formatMessageTime(message.timestamp)}
        </span>
        {message.isSidechain && (
          <span
            className="text-[10px] px-1 rounded"
            style={{
              background: "var(--accent-peach)",
              color: "var(--bg-primary)",
            }}
          >
            sidechain
          </span>
        )}
      </div>
      <div className="space-y-2">
        {message.content.map((block, index) => renderContentBlock(block, index))}
      </div>
    </div>
  );
}
