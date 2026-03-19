import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface AvailableSkill {
  name: string;
  description: string;
  isPaperclipManaged: boolean;
}

export function readSkillMarkdown(skillName: string): string | null {
  const normalized = skillName.trim().toLowerCase();
  if (
    normalized !== "paperclip" &&
    normalized !== "paperclip-create-agent" &&
    normalized !== "paperclip-create-plugin" &&
    normalized !== "para-memory-files"
  ) {
    return null;
  }
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../skills", normalized, "SKILL.md"),
    path.resolve(process.cwd(), "skills", normalized, "SKILL.md"),
    path.resolve(moduleDir, "../../../skills", normalized, "SKILL.md"),
  ];
  for (const skillPath of candidates) {
    try {
      return fs.readFileSync(skillPath, "utf8");
    } catch {
      // Continue to next candidate.
    }
  }
  return null;
}

function resolvePaperclipSkillsDir(): string | null {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../skills"),
    path.resolve(process.cwd(), "skills"),
    path.resolve(moduleDir, "../../../skills"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Skip unreadable candidates.
    }
  }
  return null;
}

function parseSkillFrontmatter(markdown: string): { description: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { description: "" };
  const yaml = match[1];
  const descMatch = yaml.match(
    /^description:\s*(?:>\s*\n((?:\s{2,}[^\n]*\n?)+)|[|]\s*\n((?:\s{2,}[^\n]*\n?)+)|["']?(.*?)["']?\s*$)/m,
  );
  if (!descMatch) return { description: "" };
  const raw = descMatch[1] ?? descMatch[2] ?? descMatch[3] ?? "";
  return {
    description: raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

export function listAvailableSkills(): AvailableSkill[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const claudeSkillsDir = path.join(homeDir, ".claude", "skills");
  const paperclipSkillsDir = resolvePaperclipSkillsDir();

  const paperclipSkillNames = new Set<string>();
  if (paperclipSkillsDir) {
    try {
      for (const entry of fs.readdirSync(paperclipSkillsDir, { withFileTypes: true })) {
        if (entry.isDirectory()) paperclipSkillNames.add(entry.name);
      }
    } catch {
      // Ignore missing paperclip skills directory.
    }
  }

  const skills: AvailableSkill[] = [];
  try {
    const entries = fs.readdirSync(claudeSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const skillMdPath = path.join(claudeSkillsDir, entry.name, "SKILL.md");
      let description = "";
      try {
        const md = fs.readFileSync(skillMdPath, "utf8");
        description = parseSkillFrontmatter(md).description;
      } catch {
        // No readable SKILL.md.
      }
      skills.push({
        name: entry.name,
        description,
        isPaperclipManaged: paperclipSkillNames.has(entry.name),
      });
    }
  } catch {
    // ~/.claude/skills/ doesn't exist.
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}
