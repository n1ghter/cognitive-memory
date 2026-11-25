import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager, type MemoryScope, scopeToSchemas, type VectorSchema } from '../db.js';
import type { PointerRef } from './store.js';

export type RefDriftStatus = 'fresh' | 'stale' | 'missing' | 'unhashed';

export interface RefDriftItem {
  id: string;
  scope: 'local' | 'global';
  status: RefDriftStatus;
  vault_path: string | null;
  wikilink: string | null;
  section: string | null;
  stored_hash: string | null;
  current_hash: string | null;
  updated?: boolean;
}

export interface CheckRefDriftArgs {
  vaultRoot?: string;
  scope?: MemoryScope;
  /** When true, updates `metadata.ref.source_hash` in SQLite for stale or unhashed refs whose files exist. */
  updateHashes?: boolean;
}

export interface CheckRefDriftResult {
  success: true;
  vault_root: string;
  summary: {
    total: number;
    fresh: number;
    stale: number;
    missing: number;
    unhashed: number;
    external_edges: number;
    inactive_external_placeholders: number;
  };
  items: RefDriftItem[];
}

/**
 * Computes a normalized LF SHA-256 hex digest for cross-platform deterministic drift checks.
 */
export function computeContentSha256(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Deterministically extracts a Markdown section matching `sectionHeading` (case-insensitive)
 * up to the next heading of equal or higher level, or EOF. Returns null if not found.
 */
export function extractMarkdownSection(content: string, sectionHeading: string): string | null {
  const target = sectionHeading
    .replace(/^#+\s*/, '')
    .trim()
    .toLowerCase();
  if (!target) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let startIdx = -1;
  let headingLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(lines[i].trim());
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].trim().toLowerCase();

    if (startIdx === -1) {
      if (title === target) {
        startIdx = i;
        headingLevel = level;
      }
    } else if (level <= headingLevel) {
      return lines.slice(startIdx, i).join('\n').trimEnd();
    }
  }

  if (startIdx === -1) return null;
  return lines.slice(startIdx).join('\n').trimEnd();
}

/**
 * Computes the deterministic SHA-256 hash for either a full file or a specific Markdown section.
 * Returns null if `section` is specified but no longer exists in `content`.
 */
export function computeRefSourceHash(content: string, section?: string): string | null {
  if (section?.trim()) {
    const slice = extractMarkdownSection(content, section);
    if (slice === null) return null;
    return computeContentSha256(slice);
  }
  return computeContentSha256(content);
}

/**
 * Resolves a zero-copy `metadata.ref` pointer (`vault_path` or `wikilink`) safely within `vaultRoot`.
 * Rejects any path traversal attempt escaping `vaultRoot`.
 */
export function resolveVaultRefPath(vaultRoot: string, ref: PointerRef): string | null {
  const root = path.resolve(vaultRoot);
  let relativeCandidate: string | null = null;

  if (typeof ref.vault_path === 'string' && ref.vault_path.trim()) {
    relativeCandidate = ref.vault_path.trim();
  } else if (typeof ref.wikilink === 'string' && ref.wikilink.trim()) {
    const cleaned = ref.wikilink
      .replace(/^\[\[|\]\]$/g, '')
      .split('|')[0]
      .split('#')[0]
      .trim();
    if (cleaned) {
      relativeCandidate = cleaned.endsWith('.md') ? cleaned : `${cleaned}.md`;
    }
  }

  if (!relativeCandidate) return null;

  const resolved = path.resolve(root, relativeCandidate);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
}

/**
 * Scans active memories carrying zero-copy `metadata.ref` pointers and deterministically detects
 * SHA-256 drift against the backing Markdown/Obsidian vault without copying raw vault prose into SQLite.
 */
export function executeCheckRefDrift(args: CheckRefDriftArgs = {}): CheckRefDriftResult {
  const vaultRoot = args.vaultRoot ? path.resolve(args.vaultRoot) : process.cwd();
  const schemas: VectorSchema[] = scopeToSchemas(args.scope ?? 'local');
  const updateHashes = Boolean(args.updateHashes);
  const db = DatabaseManager.getInstance();

  const items: RefDriftItem[] = [];
  let fresh = 0;
  let stale = 0;
  let missing = 0;
  let unhashed = 0;
  let externalEdges = 0;
  let inactiveExternalPlaceholders = 0;

  for (const schema of schemas) {
    const extEdgeRow = db
      .prepare(`SELECT COUNT(*) AS n FROM ${schema}.edges WHERE COALESCE(is_external, 0) = 1`)
      .get() as { n: number };
    externalEdges += extEdgeRow?.n ?? 0;

    const extPlaceholderRow = db
      .prepare(
        `SELECT COUNT(*) AS n FROM ${schema}.memory WHERE is_active = 0 AND COALESCE(json_extract(metadata, '$.is_external'), 0) = 1`
      )
      .get() as { n: number };
    inactiveExternalPlaceholders += extPlaceholderRow?.n ?? 0;

    const rows = db
      .prepare(
        `SELECT rowid, id, text, metadata
         FROM ${schema}.memory
         WHERE is_active = 1 AND valid_until IS NULL
           AND json_extract(metadata, '$.ref') IS NOT NULL`
      )
      .all() as { rowid: number | bigint; id: string; text: string; metadata: string }[];

    for (const row of rows) {
      let meta: Record<string, any>;
      try {
        meta = JSON.parse(row.metadata || '{}');
      } catch {
        continue;
      }
      const ref = meta.ref as PointerRef | undefined;
      if (!ref || typeof ref !== 'object') continue;

      const resolvedPath = resolveVaultRefPath(vaultRoot, ref);
      const storedHash =
        typeof ref.source_hash === 'string' && ref.source_hash.trim()
          ? ref.source_hash.trim()
          : null;
      const section =
        typeof ref.section === 'string' && ref.section.trim() ? ref.section.trim() : null;
      const vaultPath = typeof ref.vault_path === 'string' ? ref.vault_path : null;
      const wikilink = typeof ref.wikilink === 'string' ? ref.wikilink : null;

      if (!resolvedPath || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        missing++;
        items.push({
          id: row.id,
          scope: schema === 'global' ? 'global' : 'local',
          status: 'missing',
          vault_path: vaultPath,
          wikilink,
          section,
          stored_hash: storedHash,
          current_hash: null,
        });
        continue;
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const currentHash = computeRefSourceHash(content, section ?? undefined);

      if (currentHash === null) {
        missing++;
        items.push({
          id: row.id,
          scope: schema === 'global' ? 'global' : 'local',
          status: 'missing',
          vault_path: vaultPath,
          wikilink,
          section,
          stored_hash: storedHash,
          current_hash: null,
        });
        continue;
      }

      let status: RefDriftStatus;
      let updated = false;

      if (!storedHash) {
        status = 'unhashed';
        unhashed++;
      } else if (storedHash === currentHash) {
        status = 'fresh';
        fresh++;
      } else {
        status = 'stale';
        stale++;
      }

      if (updateHashes && (status === 'stale' || status === 'unhashed')) {
        const nextMeta = {
          ...meta,
          ref: {
            ...ref,
            source_hash: currentHash,
          },
        };
        const nextMetaJson = JSON.stringify(nextMeta);
        db.prepare(
          `UPDATE ${schema}.memory SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE rowid = ?`
        ).run(nextMetaJson, row.rowid);
        DatabaseManager.syncFtsRow(schema, row.rowid, row.text, nextMeta, db);
        updated = true;
      }

      items.push({
        id: row.id,
        scope: schema === 'global' ? 'global' : 'local',
        status,
        vault_path: vaultPath,
        wikilink,
        section,
        stored_hash: storedHash,
        current_hash: currentHash,
        ...(updated ? { updated: true } : {}),
      });
    }
  }

  return {
    success: true,
    vault_root: vaultRoot,
    summary: {
      total: items.length,
      fresh,
      stale,
      missing,
      unhashed,
      external_edges: externalEdges,
      inactive_external_placeholders: inactiveExternalPlaceholders,
    },
    items,
  };
}
