import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "../common/CodeBlock";

interface TextBlockProps {
  text: string;
}

export default function TextBlock({ text }: TextBlockProps) {
  return (
    <div className="text-xs leading-relaxed prose-invert max-w-none [&_p]:mb-2 [&_ul]:ml-4 [&_ol]:ml-4 [&_li]:mb-1 [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_a]:underline [&_table]:text-[10px] [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:opacity-70">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            if (match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            }
            return (
              <code
                className="px-1 py-0.5 rounded text-[11px]"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--accent-peach)",
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
