import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listAvailableSkills,
  listPaperclipManagedSkills,
  readSkillMarkdown,
} from "../routes/access-skills.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSkill(baseDir: string, name: string, description: string) {
  const dir = path.join(baseDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\ndescription: \"${description}\"\n---\n\n# ${name}\n`,
    "utf8",
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      try {
        require("node:fs").rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup failures
      }
    }
  }
});

describe("access skills", () => {
  it("lists paperclip-managed skills dynamically", () => {
    const paperclipDir = makeTempDir("paperclip-skills-");
    createSkill(paperclipDir, "paperclip", "Core skill");
    createSkill(paperclipDir, "paperclip-refactor-orchestrator", "Refactor orchestration");

    const skills = listPaperclipManagedSkills(paperclipDir);
    expect(skills.map((skill) => skill.name)).toEqual([
      "paperclip",
      "paperclip-refactor-orchestrator",
    ]);
  });

  it("reads markdown for any managed skill present on disk", () => {
    const paperclipDir = makeTempDir("paperclip-skills-");
    createSkill(paperclipDir, "paperclip-refactor-orchestrator", "Refactor orchestration");

    const markdown = readSkillMarkdown("paperclip-refactor-orchestrator", paperclipDir);
    expect(markdown).toContain("Refactor orchestration");
  });

  it("merges paperclip-managed and claude-installed skills", () => {
    const paperclipDir = makeTempDir("paperclip-skills-");
    const claudeDir = makeTempDir("claude-skills-");
    createSkill(paperclipDir, "paperclip-refactor-orchestrator", "Refactor orchestration");
    createSkill(claudeDir, "browse-qa-operator", "QA");

    const skills = listAvailableSkills({
      paperclipSkillsDir: paperclipDir,
      claudeSkillsDir: claudeDir,
    });

    expect(skills.map((skill) => skill.name)).toEqual([
      "browse-qa-operator",
      "paperclip-refactor-orchestrator",
    ]);
    expect(skills.find((skill) => skill.name === "paperclip-refactor-orchestrator")?.isPaperclipManaged).toBe(true);
  });
});
