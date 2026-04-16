import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  return (
    <div className="rounded overflow-hidden my-1">
      <div
        className="flex items-center justify-between px-3 py-1"
        style={{ background: "var(--bg-hover)" }}
      >
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {language}
        </span>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "0.75rem",
          fontSize: "11px",
          background: "var(--bg-primary)",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
