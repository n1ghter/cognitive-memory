import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MemoryScope } from '../db.js';
import { computeContentSha256, computeRefSourceHash } from '../tools/obsidian_bridge.js';
import { executeMemoryStore, type MemoryProfile, type PointerMetadata } from '../tools/store.js';

export type ImportToolSource = 'claude-code' | 'cursor';

export interface ImportedMemoryCandidate {
  text: string;
  profile: MemoryProfile;
  importance: number;
  metadata: PointerMetadata;
}

export interface ImportToolOptions {
  source: ImportToolSource;
  targetPath?: string;
  cwd?: string;
  dryRun?: boolean;
  scope?: Exclude<MemoryScope, 'all'>;
  profile?: MemoryProfile;
}

export interface ImportToolResult {
  success: true;
  source: ImportToolSource;
  dry_run: boolean;
  resolved_path: string;
  total_parsed: number;
  imported: number;
  skipped_duplicates: number;
  entries: {
    text: string;
    profile: MemoryProfile;
    vault_path?: string;
    section?: string;
    source_hash?: string;
    status: 'preview' | 'imported' | 'duplicate';
  }[];
}

function toPosixRelative(baseDir: string, filePath: string): string {
  const rel = path.relative(baseDir, filePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return path.basename(filePath);
  }
  return rel.replace(/\\/g, '/');
}

function parseSimpleFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: normalized };
  }
  const endIdx = normalized.indexOf('\n---', 4);
  if (endIdx === -1) {
    return { frontmatter: {}, body: normalized };
  }
  const fmBlock = normalized.slice(4, endIdx);
  const body = normalized.slice(endIdx + 4).replace(/^\n+/, '');
  const frontmatter: Record<string, string> = {};

  for (const line of fmBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) frontmatter[key] = val;
  }

  return { frontmatter, body };
}

interface MarkdownSectionSlice {
  section: string;
  content: string;
  bullets: string[];
}

function splitMarkdownSections(body: string, defaultSection: string): MarkdownSectionSlice[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const sections: MarkdownSectionSlice[] = [];
  let currentTitle = defaultSection;
  let currentLines: string[] = [];

  const flush = () => {
    const raw = currentLines.join('\n').trim();
    if (!raw) return;
    const bullets = currentLines
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, '').trim())
      .filter((l) => l.length >= 6);
    sections.push({ section: currentTitle, content: raw, bullets });
  };

  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line.trim());
    if (heading) {
      flush();
      currentTitle = heading[2].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

function extractLocalMarkdownLinks(content: string): string[] {
  const links = new Set<string>();
  const mdLinkRe = /\[[^\]]+\]\(([^)#\s]+\.md)\)/gi;
  for (const match of content.matchAll(mdLinkRe)) {
    const href = match[1].trim();
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      links.add(href);
    }
  }
  const wikiLinkRe = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  for (const match of content.matchAll(wikiLinkRe)) {
    const target = match[1].trim();
    if (target) links.add(target.endsWith('.md') ? target : `${target}.md`);
  }
  return [...links];
}

/**
 * Pure deterministic parser for Claude Code `MEMORY.md` and linked local topic files.
 */
export function parseClaudeCodeMemory(
  targetPath: string,
  options: { baseDir?: string; profile?: MemoryProfile } = {}
): ImportedMemoryCandidate[] {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Claude Code memory path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  const rootDir = stat.isDirectory() ? resolved : path.dirname(resolved);
  const baseDir = options.baseDir ? path.resolve(options.baseDir) : rootDir;
  const entryFile = stat.isDirectory() ? path.join(resolved, 'MEMORY.md') : resolved;
  const defaultProfile: MemoryProfile = options.profile ?? 'working';

  const queue: string[] = [];
  if (fs.existsSync(entryFile) && fs.statSync(entryFile).isFile()) {
    queue.push(entryFile);
  } else if (stat.isDirectory()) {
    const mdFiles = fs
      .readdirSync(resolved)
      .filter((f) => f.endsWith('.md'))
      .sort();
    for (const f of mdFiles) queue.push(path.join(resolved, f));
  }

  const visited = new Set<string>();
  const candidates: ImportedMemoryCandidate[] = [];

  while (queue.length > 0) {
    const filePath = queue.shift() as string;
    const canonical = path.resolve(filePath);
    if (visited.has(canonical) || !fs.existsSync(canonical)) continue;
    visited.add(canonical);

    const rawContent = fs.readFileSync(canonical, 'utf-8');
    const { frontmatter, body } = parseSimpleFrontmatter(rawContent);
    const relVaultPath = toPosixRelative(baseDir, canonical);
    const fileTitle = path.basename(canonical, '.md');

    // Follow linked local topic files within rootDir cleanly (with traversal guard)
    for (const relLink of extractLocalMarkdownLinks(body)) {
      const linked = path.resolve(path.dirname(canonical), relLink);
      const checkRel = path.relative(rootDir, linked);
      if (!checkRel.startsWith('..') && !path.isAbsolute(checkRel) && fs.existsSync(linked)) {
        queue.push(linked);
      }
    }

    const sections = splitMarkdownSections(body, fileTitle);
    const inferredProfile: MemoryProfile =
      options.profile ??
      (frontmatter.type === 'user' || /user|preference/i.test(fileTitle) ? 'user' : defaultProfile);

    for (const sec of sections) {
      const sectionHash =
        computeRefSourceHash(rawContent, sec.section) ?? computeContentSha256(rawContent);
      // Skip pure link-index bullets like `[Topic](topic.md)` when the linked topic file is crawled separately
      const meaningfulBullets = sec.bullets.filter(
        (b) => !/^\[[^\]]+\]\([^)]+\.md\)\s*$/.test(b) && !/^\[\[[^\]]+\]\]\s*$/.test(b)
      );

      if (sec.bullets.length > 0 && meaningfulBullets.length === 0) {
        continue;
      }

      if (meaningfulBullets.length > 0) {
        for (const bullet of meaningfulBullets) {
          const cleanFact = bullet.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
          if (cleanFact.length < 6) continue;
          candidates.push({
            text:
              sec.section && sec.section !== fileTitle ? `${sec.section}: ${cleanFact}` : cleanFact,
            profile: inferredProfile,
            importance: 0.7,
            metadata: {
              type: 'imported',
              source: 'claude-code',
              category: frontmatter.type || 'memory',
              tags: ['claude-code', fileTitle.toLowerCase()],
              ref: {
                vault_path: relVaultPath,
                wikilink: `[[${fileTitle}]]`,
                section: sec.section,
                source_hash: sectionHash,
              },
            },
          });
        }
      } else {
        const plain = sec.content
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\s+/g, ' ')
          .trim();
        if (plain.length >= 10) {
          candidates.push({
            text: sec.section && sec.section !== fileTitle ? `${sec.section}: ${plain}` : plain,
            profile: inferredProfile,
            importance: 0.7,
            metadata: {
              type: 'imported',
              source: 'claude-code',
              category: frontmatter.type || 'memory',
              tags: ['claude-code', fileTitle.toLowerCase()],
              ref: {
                vault_path: relVaultPath,
                wikilink: `[[${fileTitle}]]`,
                section: sec.section,
                source_hash: sectionHash,
              },
            },
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Pure deterministic parser for Cursor `.cursor/rules/*.mdc` rule files and legacy `.cursorrules`.
 */
export function parseCursorRules(
  targetPath: string,
  options: { baseDir?: string; profile?: MemoryProfile } = {}
): ImportedMemoryCandidate[] {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Cursor rules path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  const baseDir = options.baseDir
    ? path.resolve(options.baseDir)
    : stat.isDirectory()
      ? resolved
      : path.dirname(resolved);
  const profile: MemoryProfile = options.profile ?? 'agent_core';
  const files: string[] = [];

  if (stat.isFile()) {
    files.push(resolved);
  } else {
    // Support passing either repo root (containing .cursor/rules or .cursorrules) or .cursor/rules directly
    const nestedRulesDir = path.join(resolved, '.cursor', 'rules');
    const scanDir = fs.existsSync(nestedRulesDir) ? nestedRulesDir : resolved;
    for (const entry of fs.readdirSync(scanDir).sort()) {
      if (entry.endsWith('.mdc') || entry.endsWith('.md')) {
        files.push(path.join(scanDir, entry));
      }
    }
    const legacyRules = path.join(resolved, '.cursorrules');
    if (fs.existsSync(legacyRules) && fs.statSync(legacyRules).isFile()) {
      files.push(legacyRules);
    }
  }

  const candidates: ImportedMemoryCandidate[] = [];

  for (const filePath of files) {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseSimpleFrontmatter(rawContent);
    const relVaultPath = toPosixRelative(baseDir, filePath);
    const baseName = path.basename(filePath).replace(/\.(mdc|md)$/i, '');
    const tags = ['cursor', baseName.toLowerCase()];
    if (frontmatter.globs) {
      tags.push(
        ...frontmatter.globs
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean)
      );
    }

    const sections = splitMarkdownSections(body, frontmatter.description || baseName);
    for (const sec of sections) {
      const sectionHash =
        computeRefSourceHash(rawContent, sec.section) ?? computeContentSha256(rawContent);
      const items =
        sec.bullets.length > 0
          ? sec.bullets
          : [sec.content.replace(/\s+/g, ' ').trim()].filter((s) => s.length >= 10);

      for (const item of items) {
        const prefix = frontmatter.description
          ? `${frontmatter.description} — `
          : sec.section && sec.section !== baseName
            ? `${sec.section}: `
            : '';
        candidates.push({
          text: `${prefix}${item}`.trim(),
          profile,
          importance: frontmatter.alwaysApply === 'true' ? 0.85 : 0.75,
          metadata: {
            type: 'imported',
            source: 'cursor',
            category: 'rule',
            tags: [...new Set(tags)],
            ...(frontmatter.globs ? { globs: frontmatter.globs } : {}),
            ref: {
              vault_path: relVaultPath,
              section: sec.section,
              source_hash: sectionHash,
            },
          },
        });
      }
    }
  }

  return candidates;
}

/**
 * Parses CLI flags passed after `cognitive-memory import-tool`.
 */
export function parseImportToolArgs(argv: string[]): ImportToolOptions {
  let source: ImportToolSource | undefined;
  let targetPath: string | undefined;
  let dryRun = false;
  let scope: Exclude<MemoryScope, 'all'> = 'local';
  let profile: MemoryProfile | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--source' && argv[i + 1]) {
      const val = argv[++i].trim().toLowerCase();
      if (val === 'claude-code' || val === 'cursor') source = val;
    } else if (arg.startsWith('--source=')) {
      const val = arg.slice('--source='.length).trim().toLowerCase();
      if (val === 'claude-code' || val === 'cursor') source = val;
    } else if (arg === '--path' && argv[i + 1]) {
      targetPath = argv[++i];
    } else if (arg.startsWith('--path=')) {
      targetPath = arg.slice('--path='.length);
    } else if (arg === '--scope' && argv[i + 1]) {
      const val = argv[++i].trim().toLowerCase();
      if (val === 'local' || val === 'global') scope = val;
    } else if (arg.startsWith('--scope=')) {
      const val = arg.slice('--scope='.length).trim().toLowerCase();
      if (val === 'local' || val === 'global') scope = val;
    } else if (arg === '--profile' && argv[i + 1]) {
      const val = argv[++i].trim().toLowerCase();
      if (val === 'user' || val === 'working' || val === 'agent_core') profile = val;
    } else if (arg.startsWith('--profile=')) {
      const val = arg.slice('--profile='.length).trim().toLowerCase();
      if (val === 'user' || val === 'working' || val === 'agent_core') profile = val;
    }
  }

  if (!source) {
    throw new Error(
      'Missing or invalid --source. Use "--source claude-code" or "--source cursor".'
    );
  }

  return { source, targetPath, dryRun, scope, profile };
}

function resolveDefaultToolPath(source: ImportToolSource, cwd: string): string {
  if (source === 'cursor') {
    const rulesDir = path.join(cwd, '.cursor', 'rules');
    return fs.existsSync(rulesDir) ? rulesDir : cwd;
  }
  // Claude Code default: ~/.claude/projects/<encoded>/memory or ./MEMORY.md
  const localMem = path.join(cwd, 'MEMORY.md');
  if (fs.existsSync(localMem)) return localMem;
  return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * Deterministically imports Claude Code MEMORY.md or Cursor .cursor/rules/*.mdc into cognitive-memory
 * with zero-copy `metadata.ref` pointers and strict idempotency (0 duplicates on re-run).
 */
export async function runImportTool(options: ImportToolOptions): Promise<ImportToolResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const resolvedPath = options.targetPath
    ? path.resolve(options.targetPath)
    : resolveDefaultToolPath(options.source, cwd);
  const scope = options.scope ?? 'local';
  const dryRun = Boolean(options.dryRun);

  const candidates =
    options.source === 'claude-code'
      ? parseClaudeCodeMemory(resolvedPath, { baseDir: cwd, profile: options.profile })
      : parseCursorRules(resolvedPath, { baseDir: cwd, profile: options.profile });

  const entries: ImportToolResult['entries'] = [];
  let imported = 0;
  let skippedDuplicates = 0;

  for (const candidate of candidates) {
    if (dryRun) {
      entries.push({
        text: candidate.text,
        profile: candidate.profile,
        vault_path: candidate.metadata.ref?.vault_path,
        section: candidate.metadata.ref?.section,
        source_hash: candidate.metadata.ref?.source_hash,
        status: 'preview',
      });
      continue;
    }

    const res = await executeMemoryStore({
      text: candidate.text,
      profile: candidate.profile,
      importance: candidate.importance,
      scope,
      metadata: candidate.metadata,
    });

    const isDup = res.message.includes('idempotent match found');
    if (isDup) {
      skippedDuplicates++;
    } else {
      imported++;
    }

    entries.push({
      text: candidate.text,
      profile: candidate.profile,
      vault_path: candidate.metadata.ref?.vault_path,
      section: candidate.metadata.ref?.section,
      source_hash: candidate.metadata.ref?.source_hash,
      status: isDup ? 'duplicate' : 'imported',
    });
  }

  return {
    success: true,
    source: options.source,
    dry_run: dryRun,
    resolved_path: resolvedPath,
    total_parsed: candidates.length,
    imported,
    skipped_duplicates: skippedDuplicates,
    entries,
  };
}
