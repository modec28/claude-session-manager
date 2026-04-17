import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";

interface TerminalPanelProps {
  terminalId: string;
  cwd: string;
  command: string;
  onClose: () => void;
}

export default function TerminalPanel({
  terminalId,
  cwd,
  command,
  onClose,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        selectionBackground: "#45475a",
        black: "#45475a",
        red: "#f38ba8",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        magenta: "#cba6f7",
        cyan: "#94e2d5",
        white: "#bac2de",
        brightBlack: "#585b70",
        brightRed: "#f38ba8",
        brightGreen: "#a6e3a1",
        brightYellow: "#f9e2af",
        brightBlue: "#89b4fa",
        brightMagenta: "#cba6f7",
        brightCyan: "#94e2d5",
        brightWhite: "#a6adc8",
      },
      fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type === "keydown" && event.key === "Enter" && event.shiftKey) {
        invoke("write_terminal", { terminalId, data: "\n" }).catch(console.error);
        return false;
      }
      return true;
    });

    terminal.onData((data) => {
      invoke("write_terminal", { terminalId, data }).catch(console.error);
    });

    const outputUnlisten = listen<number[]>(
      `terminal-output-${terminalId}`,
      (event) => {
        terminal.write(new Uint8Array(event.payload));
      },
    );

    const exitUnlisten = listen(`terminal-exit-${terminalId}`, () => {
      terminal.write("\r\n\x1b[90m[Session ended]\x1b[0m\r\n");
      setConnected(false);
    });

    const initialCols = terminal.cols;
    const initialRows = terminal.rows;

    invoke("spawn_terminal", {
      terminalId,
      cwd,
      command,
      cols: initialCols,
      rows: initialRows,
    })
      .then(() => setConnected(true))
      .catch((error) => {
        terminal.write(`\x1b[31mFailed to start: ${error}\x1b[0m\r\n`);
      });

    terminal.onResize(({ cols, rows }) => {
      invoke("resize_terminal", { terminalId, cols, rows }).catch(console.error);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      outputUnlisten.then((unlisten) => unlisten());
      exitUnlisten.then((unlisten) => unlisten());
      resizeObserver.disconnect();
      terminal.dispose();
      invoke("close_terminal", { terminalId }).catch(() => {});
    };
  }, [terminalId]);

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100%",
        background: "#1e1e2e",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1 shrink-0"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: connected
                ? "var(--accent-green)"
                : "var(--accent-red)",
            }}
          />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {command.length > 60 ? command.slice(0, 57) + "..." : command}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] px-2 py-0.5 rounded font-bold transition-opacity hover:opacity-80"
          style={{
            background: "var(--accent-red)",
            color: "var(--bg-primary)",
          }}
          title="Close terminal (Cmd+`)"
        >
          Close
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
