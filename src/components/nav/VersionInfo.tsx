import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
}

const GITHUB_RELEASES_API =
  "https://api.github.com/repos/modec28/claude-session-manager/releases";
const RELEASES_PAGE_URL =
  "https://github.com/modec28/claude-session-manager/releases";

const CURRENT_VERSION = __APP_VERSION__;

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return (a3 ?? 0) - (b3 ?? 0);
}

export default function VersionInfo() {
  const [hovering, setHovering] = useState(false);
  const [releases, setReleases] = useState<ReleaseInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const show = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setHovering(true);
  };

  const scheduleHide = () => {
    hideTimerRef.current = window.setTimeout(() => setHovering(false), 200);
  };

  useEffect(() => {
    fetch(GITHUB_RELEASES_API)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Array<{
        tag_name: string;
        name: string;
        body: string;
        html_url: string;
        published_at: string;
      }>) => {
        const parsed: ReleaseInfo[] = data.map((r) => ({
          tagName: r.tag_name,
          name: r.name,
          body: r.body,
          htmlUrl: r.html_url,
          publishedAt: r.published_at,
        }));
        setReleases(parsed);
        if (parsed[0]) setLatestVersion(parsed[0].tagName);
      })
      .catch((err) => setLoadError(String(err)));
  }, []);

  const updateAvailable =
    latestVersion !== null &&
    compareVersions(latestVersion, CURRENT_VERSION) > 0;

  return (
    <div
      className="relative mr-10"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <span
        className="px-2 py-0.5 rounded text-[10px] font-mono cursor-default"
        style={{
          background: updateAvailable ? "var(--accent-peach)" : "var(--bg-surface)",
          color: updateAvailable ? "var(--bg-primary)" : "var(--text-muted)",
        }}
      >
        v{CURRENT_VERSION}
        {updateAvailable && ` → ${latestVersion}`}
      </span>
      {hovering && (
        <div
          className="absolute right-0 top-full mt-1 z-50 p-3 rounded-lg shadow-lg text-[10px] w-96 max-h-96 overflow-y-auto"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <div className="flex items-center justify-between mb-2 sticky top-0 pb-1"
               style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-color)" }}>
            <div className="font-bold" style={{ color: "var(--text-primary)" }}>
              Releases
            </div>
            {updateAvailable && (
              <button
                onClick={() => openUrl(RELEASES_PAGE_URL)}
                className="text-[9px] px-1.5 py-0.5 rounded font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "var(--accent-peach)",
                  color: "var(--bg-primary)",
                }}
              >
                Update →
              </button>
            )}
          </div>
          {loadError && (
            <div style={{ color: "var(--accent-red)" }}>
              Failed to load: {loadError}
            </div>
          )}
          {!releases && !loadError && (
            <div style={{ color: "var(--text-muted)" }}>Loading...</div>
          )}
          {releases?.map((release) => {
            const isCurrent = release.tagName.replace(/^v/, "") === CURRENT_VERSION;
            return (
              <div key={release.tagName} className="mb-3">
                <div className="font-bold mb-0.5" style={{ color: "var(--accent-blue)" }}>
                  {release.name || release.tagName}
                  {isCurrent && (
                    <span
                      className="ml-1 text-[9px] font-normal px-1 rounded"
                      style={{ background: "var(--accent-green)", color: "var(--bg-primary)" }}
                    >
                      current
                    </span>
                  )}
                  <span className="ml-2 text-[9px] font-normal" style={{ color: "var(--text-muted)" }}>
                    {new Date(release.publishedAt).toLocaleDateString()}
                  </span>
                </div>
                <pre
                  className="whitespace-pre-wrap font-sans text-[10px] leading-snug"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {release.body}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
