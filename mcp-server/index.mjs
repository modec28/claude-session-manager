#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import os from "os";

const ARCHIVES_DIR = path.join(os.homedir(), ".claude", "session-archives");
const PENDING_DIR = path.join(os.homedir(), ".claude", "session-pending-delete");

function ensureDirs() {
  for (const dir of [ARCHIVES_DIR, PENDING_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

const server = new McpServer({
  name: "claude-session-manager",
  version: "1.0.0",
});

server.tool(
  "save_archive",
  "Save a session archive entry. Call this when summarizing a session to persist the summary to the session manager app.",
  {
    sessionId: z.string().describe("Session ID"),
    timestamp: z.string().describe("ISO 8601 timestamp"),
    project: z.string().describe("Project/repo name"),
    cwd: z.string().describe("Working directory"),
    branch: z.string().nullable().describe("Git branch name"),
    issueKeys: z.array(z.string()).describe("Issue keys from branch/conversation"),
    title: z.string().describe("One-line summary in Korean"),
    summary: z.string().describe("2-3 sentence summary in Korean"),
    tasks: z.array(z.string()).describe("Tasks accomplished in Korean"),
    filesChanged: z.array(z.string()).describe("Files created/modified/deleted"),
    decisions: z.array(z.string()).describe("Key technical decisions in Korean"),
    tags: z.array(z.string()).describe("Tags: bugfix, feature, refactor, devops, analysis, etc."),
  },
  async (params) => {
    ensureDirs();
    const timestamp = params.timestamp.replace(/[:.]/g, "").slice(0, 15);
    const safeProject = params.project.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${timestamp}_${safeProject}.json`;
    const filepath = path.join(ARCHIVES_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(params, null, 2), "utf-8");

    return {
      content: [
        {
          type: "text",
          text: `Archive saved: ${filename}`,
        },
      ],
    };
  },
);

server.tool(
  "list_pending_deletions",
  "List sessions that are queued for deletion and need to be summarized first.",
  {},
  async () => {
    ensureDirs();
    const files = fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith(".json"));
    const pending = files.map((f) => {
      const content = fs.readFileSync(path.join(PENDING_DIR, f), "utf-8");
      return JSON.parse(content);
    });

    return {
      content: [
        {
          type: "text",
          text: pending.length > 0
            ? JSON.stringify(pending, null, 2)
            : "No pending deletions.",
        },
      ],
    };
  },
);

server.tool(
  "confirm_deletion",
  "Confirm deletion of a session after it has been archived. This removes the session file and clears the pending queue.",
  {
    sessionId: z.string().describe("Session ID to delete"),
    projectDirName: z.string().describe("Project directory name in .claude/projects/"),
  },
  async ({ sessionId, projectDirName }) => {
    ensureDirs();
    const projectsBase = path.join(os.homedir(), ".claude", "projects");
    const sessionFile = path.join(projectsBase, projectDirName, `${sessionId}.jsonl`);
    const sessionDir = path.join(projectsBase, projectDirName, sessionId);
    const pendingFile = path.join(PENDING_DIR, `${sessionId}.json`);

    const removed = [];

    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      removed.push(sessionFile);
    }
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true });
      removed.push(sessionDir);
    }
    if (fs.existsSync(pendingFile)) {
      fs.unlinkSync(pendingFile);
      removed.push(pendingFile);
    }

    return {
      content: [
        {
          type: "text",
          text: removed.length > 0
            ? `Deleted: ${removed.join(", ")}`
            : `Nothing to delete for session ${sessionId}`,
        },
      ],
    };
  },
);

server.tool(
  "list_archives",
  "List all saved session archives.",
  {},
  async () => {
    ensureDirs();
    const files = fs.readdirSync(ARCHIVES_DIR).filter((f) => f.endsWith(".json"));
    const archives = files.map((f) => {
      const content = fs.readFileSync(path.join(ARCHIVES_DIR, f), "utf-8");
      return { ...JSON.parse(content), filename: f };
    });
    archives.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(archives, null, 2),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
