import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface AvailableSkill {
  name: string;
  description: string;
  isPaperclipManaged: boolean;
}

export function resolvePaperclipSkillsDir(customDir?: string | null): string | null {
  if (customDir) {
    try {
      if (fs.statSync(customDir).isDirectory()) return customDir;
    } catch {
      return null;
    }
  }
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

function resolvePaperclipSkillMarkdownPath(skillName: string, customDir?: string | null): string | null {
  const normalized = skillName.trim().toLowerCase();
  if (!normalized) return null;
  const skillsDir = resolvePaperclipSkillsDir(customDir);
  if (!skillsDir) return null;
  const skillPath = path.join(skillsDir, normalized, "SKILL.md");
  try {
    if (fs.statSync(skillPath).isFile()) return skillPath;
  } catch {
    return null;
  }
  return null;
}

export function readSkillMarkdown(skillName: string, customDir?: string | null): string | null {
  const skillPath = resolvePaperclipSkillMarkdownPath(skillName, customDir);
  if (!skillPath) return null;
  try {
    return fs.readFileSync(skillPath, "utf8");
  } catch {
    return null;
  }
}

export function listPaperclipManagedSkills(customDir?: string | null): AvailableSkill[] {
  const skillsDir = resolvePaperclipSkillsDir(customDir);
  if (!skillsDir) return [];
  const skills: AvailableSkill[] = [];
  try {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const markdown = readSkillMarkdown(entry.name, skillsDir);
      if (!markdown) continue;
      skills.push({
        name: entry.name,
        description: parseSkillFrontmatter(markdown).description,
        isPaperclipManaged: true,
      });
    }
  } catch {
    return [];
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export function listAvailableSkills(customPaths?: {
  claudeSkillsDir?: string | null;
  paperclipSkillsDir?: string | null;
}): AvailableSkill[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const claudeSkillsDir = customPaths?.claudeSkillsDir ?? path.join(homeDir, ".claude", "skills");
  const paperclipSkillsDir = resolvePaperclipSkillsDir(customPaths?.paperclipSkillsDir);

  const skills = new Map<string, AvailableSkill>();
  for (const skill of listPaperclipManagedSkills(paperclipSkillsDir)) {
    skills.set(skill.name, skill);
  }

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
      skills.set(entry.name, {
        name: entry.name,
        description,
        isPaperclipManaged: skills.get(entry.name)?.isPaperclipManaged ?? false,
      });
    }
  } catch {
    // ~/.claude/skills/ doesn't exist.
  }

  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name));
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
