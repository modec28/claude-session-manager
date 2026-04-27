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
  label?: string;
}

const SPECIAL_KEY_SEQUENCES: Record<string, string> = {
  Enter: "\r",
  Backspace: "\x7f",
  Tab: "\t",
  Escape: "\x1b",
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowRight: "\x1b[C",
  ArrowLeft: "\x1b[D",
  Home: "\x1b[H",
  End: "\x1b[F",
  PageUp: "\x1b[5~",
  PageDown: "\x1b[6~",
  Delete: "\x1b[3~",
};

export default function TerminalPanel({
  terminalId,
  cwd,
  command,
  label,
  onClose,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isComposingRef = useRef(false);
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

    const xtermHelper = containerRef.current.querySelector<HTMLTextAreaElement>(
      ".xterm-helper-textarea",
    );
    xtermHelper?.setAttribute("tabindex", "-1");

    let lastSyntheticMouseUp = 0;
    const releaseStuckDrag = (event: MouseEvent) => {
      if (event.buttons !== 0) return;
      const now = performance.now();
      if (now - lastSyntheticMouseUp < 50) return;
      lastSyntheticMouseUp = now;
      const screen = containerRef.current?.querySelector(".xterm-screen");
      if (!screen) return;
      screen.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      );
    };
    document.addEventListener("mousemove", releaseStuckDrag);

    const globalCtrlCapture = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      const inPanel =
        active === inputRef.current ||
        !!containerRef.current?.contains(active);
      if (!inPanel) return;
      const code = event.code;
      if (code.startsWith("Key") && code.length === 4) {
        const letter = code.charCodeAt(3);
        if (letter >= 0x41 && letter <= 0x5a) {
          event.preventDefault();
          event.stopPropagation();
          invoke("write_terminal", {
            terminalId,
            data: String.fromCharCode(letter - 0x40),
          }).catch(console.error);
        }
      }
    };
    window.addEventListener("keydown", globalCtrlCapture, true);

    inputRef.current?.focus();

    return () => {
      document.removeEventListener("mousemove", releaseStuckDrag);
      window.removeEventListener("keydown", globalCtrlCapture, true);
      outputUnlisten.then((unlisten) => unlisten());
      exitUnlisten.then((unlisten) => unlisten());
      resizeObserver.disconnect();
      terminal.dispose();
      invoke("close_terminal", { terminalId }).catch(() => {});
    };
  }, [terminalId]);

  const send = (data: string) => {
    invoke("write_terminal", { terminalId, data }).catch(console.error);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (
    event: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    isComposingRef.current = false;
    if (event.data) send(event.data);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return;
    const nativeEvent = event.nativeEvent as InputEvent;
    const text = nativeEvent.data ?? "";
    if (
      (nativeEvent.inputType === "insertText" ||
        nativeEvent.inputType === "insertFromPaste" ||
        nativeEvent.inputType === "insertCompositionText") &&
      text
    ) {
      send(text);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current || event.nativeEvent.isComposing) return;

    const { key, ctrlKey, metaKey, shiftKey } = event;

    if (metaKey) {
      if (key === "c" || key === "C") {
        const terminal = terminalRef.current;
        if (terminal?.hasSelection()) {
          event.preventDefault();
          navigator.clipboard
            .writeText(terminal.getSelection())
            .catch(console.error);
        }
        return;
      }
      if (key === "a" || key === "A") {
        event.preventDefault();
        terminalRef.current?.selectAll();
        return;
      }
      if (key === "v" || key === "V") return;
      if (key === "`") return;
    }

    if (key === "Enter") {
      event.preventDefault();
      send(shiftKey ? "\\\r" : "\r");
      return;
    }

    const mapped = SPECIAL_KEY_SEQUENCES[key];
    if (mapped) {
      event.preventDefault();
      send(mapped);
      return;
    }

    if (ctrlKey && !metaKey) {
      const code = event.code;
      if (code.startsWith("Key") && code.length === 4) {
        const letter = code.charCodeAt(3);
        if (letter >= 0x41 && letter <= 0x5a) {
          event.preventDefault();
          send(String.fromCharCode(letter - 0x40));
          return;
        }
      }
    }
  };

  const refocusInput = () => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

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
          {label && (
            <span
              className="text-[10px] font-bold px-1.5 rounded"
              style={{ background: "var(--bg-surface)", color: "var(--accent-blue)" }}
            >
              {label}
            </span>
          )}
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
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        <textarea
          ref={inputRef}
          aria-label="terminal input"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={refocusInput}
          className="absolute inset-0 w-full h-full resize-none"
          style={{
            background: "transparent",
            color: "transparent",
            caretColor: "transparent",
            border: "none",
            outline: "none",
            pointerEvents: "none",
            padding: 0,
          }}
        />
      </div>
    </div>
  );
}
